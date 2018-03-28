// Deployed contracts
let DNNTDE = artifacts.require("./DNNTDE.sol");
let DNNToken = artifacts.require("./DNNToken.sol");
let BigNumber = require('bignumber.js');

contract("DNNBonuses", function(accounts) {

      // Helpers
      let WeiToETH = function(num, shouldNotConvertToNumber) {
          let result = num.dividedBy(new BigNumber(10).pow(18))
          return shouldNotConvertToNumber ? result : result.toNumber();
      };
      let ETHToWei = function(num, shouldNotConvertToNumber) {
          let result = (new BigNumber(10).pow(18)).times(num)
          return shouldNotConvertToNumber ? result : result.toNumber();
      };
      let progressTimeBySeconds = async function(seconds) {
          return web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [seconds], id: 0});
      };
      let nowPlusOrMinusYears = function(yearCount) {
          let date = new Date();
          date.setFullYear(date.getFullYear() + yearCount);
          return Math.floor( date / 1000 );
      };
      let isException = function(error) {
          let strError = error.toString();
          return strError.includes('invalid opcode') || strError.includes('invalid JUMP');
      };
      let ensureException = function(error) {
          assert(isException(error), error.toString());
      };

      // Constants
      let account0 = accounts[0];
      let account1 = accounts[1];
      let account2 = accounts[2];
      let account3 = accounts[3];
      let account4 = accounts[4];
      let account5 = accounts[5];
      let account6 = accounts[6];
      let account7 = accounts[7];
      let account8 = accounts[8];
      let account9 = accounts[9];

      let gasAmount = 4000000;
      let TDEStartDate = nowPlusOrMinusYears(0);
      let TDEEndDate = nowPlusOrMinusYears(3);

      let EarlyBackerSupplyAllocation = 0;
      let PRETDESupplyAllocation = 1;
      let TDESupplyAllocation = 2;
      let BountySupplyAllocation = 3;
      let WriterAccountSupplyAllocation = 4;
      let AdvisorySupplyAllocation = 5;
      let PlatformSupplyAllocation = 6;

      it("function() + buyTokens(): Cumulative Bonus when 0-25% of funding goal reached", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(account1, account2, account3, 0, {from: account1, gas: gasAmount});

            // Deploy new tde contract
            const tde = await DNNTDE.new(token.address, account1, account2, account3, 10, 0, 0, {from: account1, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(tde.address, {from: account1, gas: gasAmount});

            // End PreTDE
            await tde.finalizePRETDE({from: account1, gas: gasAmount});

            // Buy DNN
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("0.5", "Ether")});

            // End TDE
            await tde.releaseTrickleDownBonuses({from: account1, gas: gasAmount});

            // Check if bonuses were released
            let trickleDownBonusesReleased = await tde.trickleDownBonusesReleased.call({from: account1, gas: gasAmount});
            assert.equal(trickleDownBonusesReleased, true, "Trickle down bonuses should have been released");

            // Check if trickle down bonus was applied correctly
            let account1_balance = await token.balanceOf.call(account1, {from: account1, gas: gasAmount});
            assert.equal(WeiToETH(account1_balance), 5400, "The token balance with the additional bounus 5400");
      });

      it("function() + buyTokens(): Cumulative Bonus when 25%-50% of funding goal reached", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(account1, account2, account3, 0, {from: account1, gas: gasAmount});

            // Deploy new tde contract
            const tde = await DNNTDE.new(token.address, account1, account2, account3, 10, 0, 0, {from: account1, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(tde.address, {from: account1, gas: gasAmount});

            // End PreTDE
            await tde.finalizePRETDE({from: account1, gas: gasAmount});

            // Buy DNN
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});

            // End TDE
            await tde.releaseTrickleDownBonuses({from: account1, gas: gasAmount});

            // Check if bonuses were released
            let trickleDownBonusesReleased = await tde.trickleDownBonusesReleased.call({from: account1, gas: gasAmount});
            assert.equal(trickleDownBonusesReleased, true, "Trickle down bonuses should have been released");

            // Check if trickle down bonus was applied correctly
            let account1_balance = await token.balanceOf.call(account1, {from: account1, gas: gasAmount});
            assert.equal(WeiToETH(account1_balance), 3900, "The token balance with the additional bounus 3900");

            // Check if trickle down bonus was applied correctly
            let account2_balance = await token.balanceOf.call(account2, {from: account2, gas: gasAmount});
            assert.equal(WeiToETH(account2_balance), 14040, "The token balance with the additional bounus 14040");

      });

      it("function() + buyTokens(): Cumulative Bonus when 50%-75% of funding goal reached", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(account1, account2, account3, 0, {from: account1, gas: gasAmount});

            // Deploy new tde contract
            const tde = await DNNTDE.new(token.address, account1, account2, account3, 10, 0, 0, {from: account1, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(tde.address, {from: account1, gas: gasAmount});

            // End PreTDE
            await tde.finalizePRETDE({from: account1, gas: gasAmount});

            // Buy DNN
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("2", "Ether")});

            // End TDE
            await tde.releaseTrickleDownBonuses({from: account1, gas: gasAmount});

            // Check if bonuses were released
            let trickleDownBonusesReleased = await tde.trickleDownBonusesReleased.call({from: account1, gas: gasAmount});
            assert.equal(trickleDownBonusesReleased, true, "Trickle down bonuses should have been released");

            // Check if trickle down bonus was applied correctly
            let account1_balance = await token.balanceOf.call(account1, {from: account1, gas: gasAmount});
            assert.equal(WeiToETH(account1_balance), 10920, "The token balance with the additional bounus 10920");

            // Check if trickle down bonus was applied correctly
            let account2_balance = await token.balanceOf.call(account2, {from: account2, gas: gasAmount});
            assert.equal(WeiToETH(account2_balance), 18360, "The token balance with the additional bounus 18360");

      });

      it("function() + buyTokens(): Cumulative Bonus when 75%-100% of funding goal reached", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(account1, account2, account3, 0, {from: account1, gas: gasAmount});

            // Deploy new tde contract
            const tde = await DNNTDE.new(token.address, account1, account2, account3, 10, 0, 0, {from: account1, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(tde.address, {from: account1, gas: gasAmount});

            // End PreTDE
            await tde.finalizePRETDE({from: account1, gas: gasAmount});

            // Buy DNN
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("2", "Ether")});
            await web3.eth.sendTransaction({from: account3, to: tde.address, gas: gasAmount, value: web3.toWei("2", "Ether")});
            await web3.eth.sendTransaction({from: account4, to: tde.address, gas: gasAmount, value: web3.toWei("2", "Ether")});

            // End TDE
            await tde.releaseTrickleDownBonuses({from: account1, gas: gasAmount});

            // Check if bonuses were released
            let trickleDownBonusesReleased = await tde.trickleDownBonusesReleased.call({from: account1, gas: gasAmount});
            assert.equal(trickleDownBonusesReleased, true, "Trickle down bonuses should have been released");

            // Check if trickle down bonus was applied correctly
            let account1_balance = await token.balanceOf.call(account1, {from: account1, gas: gasAmount});
            assert.equal(WeiToETH(account1_balance), 14820, "The token balance with the additional bounus 14820");

            // Check if trickle down bonus was applied correctly
            let account2_balance = await token.balanceOf.call(account2, {from: account2, gas: gasAmount});
            assert.equal(WeiToETH(account2_balance), 23760, "The token balance with the additional bounus 23760");

            // Check if trickle down bonus was applied correctly
            let account3_balance = await token.balanceOf.call(account3, {from: account3, gas: gasAmount});
            assert.equal(WeiToETH(account3_balance), 12600, "The token balance with the additional bounus 12600");

            // Check if trickle down bonus was applied correctly
            let account4_balance = await token.balanceOf.call(account4, {from: account4, gas: gasAmount});
            assert.equal(WeiToETH(account4_balance), 9000, "The token balance with the additional bounus 9000");
      });

      it("function() + buyTokens(): Cumulative Bonus at 20%", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(account1, account2, account3, 0, {from: account1, gas: gasAmount});

            // Deploy new tde contract
            const tde = await DNNTDE.new(token.address, account1, account2, account3, 10, 0, 0, {from: account1, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(tde.address, {from: account1, gas: gasAmount});

            // End PreTDE
            await tde.finalizePRETDE({from: account1, gas: gasAmount});

            // Buy DNN
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("5", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});

            // End TDE
            await tde.finalizeTDE({from: account1, gas: gasAmount});

            // Check if bonuses were released
            let trickleDownBonusesReleased = await tde.trickleDownBonusesReleased.call({from: account1, gas: gasAmount});
            assert.equal(trickleDownBonusesReleased, true, "Trickle down bonuses should have been released");

            // Check if trickle down bonus was applied correctly
            let account1_balance = await token.balanceOf.call(account1, {from: account1, gas: gasAmount});
            assert.equal(WeiToETH(account1_balance), 50820, "The token balance with the additional bounus 50820");
      });

      it("function() + buyTokens(): Cumulative Bonus at 30%", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(account1, account2, account3, 0, {from: account1, gas: gasAmount});

            // Deploy new tde contract
            const tde = await DNNTDE.new(token.address, account1, account2, account3, 10, 0, 0, {from: account1, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(tde.address, {from: account1, gas: gasAmount});

            // End PreTDE
            await tde.finalizePRETDE({from: account1, gas: gasAmount});

            // Buy DNN
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("5", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});

            // End TDE
            await tde.finalizeTDE({from: account1, gas: gasAmount});

            // Check if bonuses were released
            let trickleDownBonusesReleased = await tde.trickleDownBonusesReleased.call({from: account1, gas: gasAmount});
            assert.equal(trickleDownBonusesReleased, true, "Trickle down bonuses should have been released");

            // Check if trickle down bonus was applied correctly
            let account1_balance = await token.balanceOf.call(account1, {from: account1, gas: gasAmount});
            assert.equal(WeiToETH(account1_balance), 37050, "The token balance with the additional bounus 37050");
      });

      it("function() + buyTokens(): Cumulative Bonus at 40%", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(account1, account2, account3, 0, {from: account1, gas: gasAmount});

            // Deploy new tde contract
            const tde = await DNNTDE.new(token.address, account1, account2, account3, 10, 0, 0, {from: account1, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(tde.address, {from: account1, gas: gasAmount});

            // End PreTDE
            await tde.finalizePRETDE({from: account1, gas: gasAmount});

            // Buy DNN
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("2", "Ether")});

            // End TDE
            await tde.finalizeTDE({from: account1, gas: gasAmount});

            // Check if bonuses were released
            let trickleDownBonusesReleased = await tde.trickleDownBonusesReleased.call({from: account1, gas: gasAmount});
            assert.equal(trickleDownBonusesReleased, true, "Trickle down bonuses should have been released");

            // Check if trickle down bonus was applied correctly
            let account1_balance = await token.balanceOf.call(account1, {from: account1, gas: gasAmount});
            assert.equal(WeiToETH(account1_balance), 18900, "The token balance with the additional bounus 18900");
      });

      it("function() + buyTokens(): Cumulative Bonus at 50%", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(account1, account2, account3, 0, {from: account1, gas: gasAmount});

            // Deploy new tde contract
            const tde = await DNNTDE.new(token.address, account1, account2, account3, 10, 0, 0, {from: account1, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(tde.address, {from: account1, gas: gasAmount});

            // End PreTDE
            await tde.finalizePRETDE({from: account1, gas: gasAmount});

            // Buy DNN
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("2", "Ether")});

            // End TDE
            await tde.finalizeTDE({from: account1, gas: gasAmount});

            let TDEContributorCount = await tde.TDEContributorCount({from: account1, gas: gasAmount});
            assert.equal(TDEContributorCount, 2, "The number of contributors should be " + 2);

            // Check if bonuses were released
            let trickleDownBonusesReleased = await tde.trickleDownBonusesReleased.call({from: account1, gas: gasAmount});
            assert.equal(trickleDownBonusesReleased, true, "Trickle down bonuses should have been released");

            // Check if trickle down bonus was applied correctly
            let account1_balance = await token.balanceOf.call(account1, {from: account1, gas: gasAmount});
            assert.equal(WeiToETH(account1_balance), 9000, "The token balance with the additional bounus 9000");
      });

      it("function() + buyTokens(): Contributing at different bonus ranges from 1 user", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(account1, account2, account3, 0, {from: account1, gas: gasAmount});

            // Deploy new tde contract
            const tde = await DNNTDE.new(token.address, account1, account2, account3, 10, 0, 0, {from: account1, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(tde.address, {from: account1, gas: gasAmount});

            // End PreTDE
            await tde.finalizePRETDE({from: account1, gas: gasAmount});

            // Buy DNN
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("2", "Ether")});
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("2", "Ether")});
            await web3.eth.sendTransaction({from: account2, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});
            await web3.eth.sendTransaction({from: account1, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});

            // End TDE
            await tde.finalizeTDE({from: account1, gas: gasAmount});

            // Range ETH
            let rangeETHAmount = await tde.rangeETHAmount({from: account1, gas: gasAmount});
            assert.equal(WeiToETH(rangeETHAmount), 2, "Range ETH " + 2);

            // TDE Contributor Count
            let TDEContributorCount = await tde.TDEContributorCount({from: account1, gas: gasAmount});
            assert.equal(TDEContributorCount, 2, "The number of contributors should be " + 2);

            // Check if bonuses were released
            let trickleDownBonusesReleased = await tde.trickleDownBonusesReleased.call({from: account1, gas: gasAmount});
            assert.equal(trickleDownBonusesReleased, true, "Trickle down bonuses should have been released");

            // Check if trickle down bonus was applied correctly
            let account1_balance = await token.balanceOf.call(account1, {from: account1, gas: gasAmount});
            assert.equal(WeiToETH(account1_balance), 44880, "The token balance with the additional bounus 44880");
      });

});
