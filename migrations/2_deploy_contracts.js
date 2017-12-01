// GAS: 2316678 @ 20 GWEI per Gas = (2316678 * 20 / 10^9) = 0.04633356
var DNNToken = artifacts.require("./DNNToken.sol");

// GAS: 1785098 @ 20 GWEI per Gas = (1785098 * 20 / 10^9) = 0.03570196
var DNNTDE = artifacts.require("./DNNTDE.sol");

var CofounderA = "0x3Cf26a9FE33C219dB87c2e50572e50803eFb2981";
var CofounderB = "0x9FFE2aD5D76954C7C25be0cEE30795279c4Cab9f";
var DNNHolding = CofounderA;

var hardcap = 70000 // 70k ETH
var startDate = 1510103554
var endDate = 1541638702

module.exports = function(deployer) {
    deployer
      .deploy(DNNToken, CofounderA, CofounderB, DNNHolding, startDate)
      .then(function() {
            deployer.deploy(DNNTDE, DNNToken.address, CofounderA, CofounderB, DNNHolding, hardcap, startDate, endDate);
      })
};
