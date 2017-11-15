var DNNToken = artifacts.require("./DNNToken.sol");
var DNNTDE = artifacts.require("./DNNTDE.sol");
var wallet = "0x000e159Cf38082c043173eadA871baB614D62B80";
var hardcap = 100000
var startDate = 1510103554
var endDate = 1541638702

module.exports = function(deployer) {
    deployer
      .deploy(DNNToken, wallet, wallet, wallet, startDate)
      .then(function() {
            deployer.deploy(DNNTDE, DNNToken.address, wallet, wallet, wallet, hardcap, startDate, endDate);
      })
};
