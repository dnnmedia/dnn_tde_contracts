var DNNToken = artifacts.require("./DNNToken.sol");
var DNNICO = artifacts.require("./DNNICO.sol");
var wallet = "0x000e159Cf38082c043173eadA871baB614D62B80";
var hardcap = 100000 * Math.pow(10, 18);

module.exports = function(deployer) {
    deployer
      .deploy(DNNToken, wallet, wallet)
      .then(function() {
            deployer.deploy(DNNICO, DNNToken.address, wallet, wallet, wallet, hardcap, 1508888478, 1540424474);
      })
};
