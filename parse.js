const fs = require("fs");
const { toBech32, fromBech32 } = require('cosmwasm');
const axios = require("axios");
const xlsx = require("node-xlsx");

const minimumBalance = 50;

const checkDelegations = async (address) => {
    try {
        const response = await axios.get(`https://rest.stargaze-1.publicawesome.dev/cosmos/staking/v1beta1/delegations/${address}`);
        if(!response.data || !response.data.delegation_responses) {
            console.error("Error: Failed to fetch delegations for address: " + address);
            return {
                eligible: false
            }
        }
        const delegatedStarsBalance = response.data.delegation_responses.find((delegationResponse) => (delegationResponse.delegation.shares / (10**6)) >= minimumBalance);
        if(delegatedStarsBalance) {
            return {
                eligible: true,
                balance: delegatedStarsBalance.delegation.shares / 10**6
            }
        }
    } catch (error) {
        console.error(error.message);
        console.error("Error: Failed to fetch delegations for address: " + address);
    }
    return {
        eligible: false
    };
}

const checkStarsBalance = async (address) => {
    try {
        const response = await axios.get(`https://rest.stargaze-1.publicawesome.dev/cosmos/bank/v1beta1/balances/${address}`);
        if(!response.data || !response.data.balances) {
            console.error("Error: Failed to fetch balance for address: " + address);
            return {
                eligible: false
            }
        }
        const starsBalance = response.data.balances.find((balance) => balance.denom === "ustars" && (balance.amount / (10**6) >= minimumBalance));
        if(starsBalance) {
            return {
                eligible: true,
                balance: starsBalance.amount / 10**6
            }
        }
    } catch (error) {
        console.error(error.message);
        console.error("Error: Failed to fetch balance for address: " + address);
    }
    return {
        eligible: false
    }
}

const checkBalances = async (snapshot) => {
    let eligibleAddresses = [["Address", "Stars Balance", "Delegated Stars Balance"]];
    for(const address of snapshot) {
            
        const starsBalance = await checkStarsBalance(address);
        const delegatedStarsBalance = await checkDelegations(address);

        // Skip if the address doesn't meet the minimum balance requirement
        if(!starsBalance.eligible && !delegatedStarsBalance.eligible) continue;

        // Save balances and address
        eligibleAddresses.push([
            address,
            starsBalance.balance ?? "X",
            delegatedStarsBalance.balance ?? "X"
        ]);
    }
    return eligibleAddresses;
}

const toStars = (address) => {
    try {
        const { prefix, data } = fromBech32(address);
        const compatiblePrefixes = ['osmo', 'cosmos', 'stars', 'regen'];
        if (!compatiblePrefixes.includes(prefix)) {
            return null
        }
        const starsAddr = toBech32('stars', data);
        if (![20, 32].includes(data.length)) {
            return {
                success: false
            }
        }
        return starsAddr;
    } catch (e) {
        return null
    }
};

const parseAddresses = () => {
    let validAddresses = [], invalidAddresses = [];
    const oldData = JSON.parse(fs.readFileSync("./data/original.json", { encoding: "utf8" }));
    let addresses = [];
    for(const value of Object.values(oldData)) {
        addresses.push(value['Your $STARS address']);
    }

    for(const address of addresses) {
        const validAddress = toStars(address);
        if(!validAddress) {
            invalidAddresses.push(address)
        } else {
            validAddresses.push(validAddress);
        }
    }
    return {
        invalidAddresses, validAddresses
    }
}

const grabStats = async () => {
    
    const {validAddresses, invalidAddresses} = parseAddresses();
    const eligibleAddresses = await checkBalances(validAddresses);

    // Create buffer for XLSX file including all eligible addresses & balances
    const spreadsheetBuffer = xlsx.build([{ name: `Parsed Submissions`, data: eligibleAddresses }]);
    
    // Write spreadsheet to filesystem
    fs.writeFileSync("./data/snapshot.xlsx", spreadsheetBuffer);
    // Write invalid addresses to filesystem
    fs.writeFileSync(
        "./data/invalid_addresses.json",
        JSON.stringify(invalidAddresses, null, 2),
        {
            encoding: "utf8"
        }
    );
    // Write valid addresses to filesystem
    fs.writeFileSync(
        "./data/valid_addresses.json",
        JSON.stringify(validAddresses, null, 2),
        {
            encoding: "utf8"
        }
    );
    // Write eligible addresses & balances to filesystem
    fs.writeFileSync(
        "./data/eligibleAddresses.json", 
        JSON.stringify(eligibleAddresses, null, 2), 
        { 
            encoding: "utf8" 
        }
    );
    
    console.log("### DETAILS ###");
    console.log("Valid addresses: " + validAddresses.length);
    console.log("Invalid addresses: " + invalidAddresses.length);
    console.log("Eligible addresses (>50 $stars delegated or > 50 $stars undelegated): " + eligibleAddresses.length);
}

grabStats();