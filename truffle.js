module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gas:3000000
    },
    kovan: {
      host: "parity.dnn.media",
      port: 8545,
      network_id: "*", // Match any network id
      gas:3000000
    }
  }
};
