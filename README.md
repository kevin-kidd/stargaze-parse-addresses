## Description
The purpose of this repository is to parse through a list of address submissions for the 'Stargaze Names' whitelist typeform.
The original form submissions are found in `data/original.json` and have been parsed to separate all the addresses with a minimum balance of 3 NFTs and 50 Stars.
The output contains lists of valid addresses converted from Cosmos, Osmo, Regen to a Stars address. The invalid addresses are also saved to a separate file.

To parse the list, simply run `node parse.js`