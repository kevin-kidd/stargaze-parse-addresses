const fs = require("fs");
const { toBech32, fromBech32 } = require('cosmwasm');
const axios = require("axios");

let validAddresses = [];
let invalidAddresses = [];

const checkDelegations = async (address, amount) => {
    try {
        const response = await axios.get(`https://rest.stargaze-1.publicawesome.dev/cosmos/staking/v1beta1/delegations/${address}`);
        if(!response.data || !response.data.delegation_responses) {
            console.error("Error: Failed to fetch delegations for address: " + address);
        }
        if(response.data.delegation_responses.some(
            (delegationResponse) => (delegationResponse.delegation.shares / (10**6)) > amount)
        ) return true;
    } catch (e) {
        console.error(e.message);
        console.error("Error: Failed to fetch delegations for address: " + address);
    }
    return false;
}

const checkBalances = async (snapshot) => {
    let minBalanceAddresses = [];
    let zeroBalanceAddresses = [];
    for(const address of snapshot) {
        try {
            const response = await axios.get(`https://rest.stargaze-1.publicawesome.dev/cosmos/bank/v1beta1/balances/${address}`);
            if(!response.data || !response.data.balances) {
                console.error("Error: Failed to fetch balance for address: " + address);
                continue;
            }
            if(!response.data.balances.some((balance) => balance.denom === "ustars" && (balance.amount / (10**6)) > 50)) {
                if(await checkDelegations(address, 50)) {
                    minBalanceAddresses.push(address);
                }
            } else {
                minBalanceAddresses.push(address);
            }
            if(!(response.data.balances.some((balance) => balance.denom === "ustars" && balance.amount >= 0))) {
                if(!(await checkDelegations(address, 0))) {
                    zeroBalanceAddresses.push(address);
                }
            }
        } catch (e) {
            console.error(e.message);
            console.error("Error: Failed to fetch balance for address: " + address);
        }
    }
    return {
        minBalanceAddresses: minBalanceAddresses,
        zeroBalanceAddresses: zeroBalanceAddresses
    };
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

const checkInventory = async (snapshot) => {
    let qualifiedAddresses = [];
    for(const address of snapshot) {
        try {
            const response = await axios.get(`https://nft-api.stargaze-apis.com/api/v1beta/profile/${address}/nfts`);
            if(!response.data) {
                console.error("Error: Failed to fetch inventory for address: " + address);
                continue;
            }
            if(response.data.length > 3) qualifiedAddresses.push(address);
        } catch (e) {
            console.error(e);
            console.error("Error: Failed to fetch inventory for address: " + address);
        }
    }
    return qualifiedAddresses;
}

const parseAddresses = () => {
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
    fs.writeFileSync(
        "./data/invalid_addresses.json",
        JSON.stringify(invalidAddresses, null, 2),
        {
            encoding: "utf8"
        }
    );
    fs.writeFileSync(
        "./data/valid_addresses.json",
        JSON.stringify(validAddresses, null, 2),
        {
            encoding: "utf8"
        }
    );
}

const grabStats = async () => {
    parseAddresses();
    const {minBalanceAddresses, zeroBalanceAddresses} = await checkBalances(validAddresses);
    const minNFTs = await checkInventory(validAddresses);
    fs.writeFileSync("./data/50orMoreStars.json", JSON.stringify(minBalanceAddresses, null, 2), { encoding: "utf8" });
    fs.writeFileSync("./data/zeroBalance.json", JSON.stringify(zeroBalanceAddresses, null, 2), { encoding: "utf8" });
    fs.writeFileSync("./data/3orMoreNFTs.json", JSON.stringify(minNFTs, null, 2), { encoding: "utf8" });
    console.log("### DETAILS ###");
    console.log(`Valid addresses: ${validAddresses.length}`);
    console.log(`Invalid addresses: ${invalidAddresses.length}`);
    console.log("Addresses with >50 $stars (delegated or undelegated): " + minBalanceAddresses.length);
    console.log("Addresses with 0 $stars (delegated or undelegated): " + zeroBalanceAddresses.length);
    console.log("Addresses with > 3 NFTs: " + minNFTs.length);
}

grabStats();