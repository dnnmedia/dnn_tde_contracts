// Deployed contracts
let DNNTDE = artifacts.require("./DNNTDE.sol");
let DNNToken = artifacts.require("./DNNToken.sol");
let BigNumber = require('bignumber.js');

contract("DNNTDE", function(accounts) {

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
      let multisig = accounts[0];
      let cofounderA = accounts[1];
      let cofounderB = accounts[2];
      let advisory = accounts[3];
      let writerAccount = accounts[4];
      let earlyBacker = accounts[5];
      let bountyContributor = accounts[6];
      let platform = accounts[7];

      let hardcap = 70000;
      let gasAmount = 4000000;
      let buyer_address = accounts[8];
      let user_address = accounts[9];
      let TDEStartDate = nowPlusOrMinusYears(0);
      let TDEEndDate = nowPlusOrMinusYears(3);

      let EarlyBackerSupplyAllocation = 0;
      let PRETDESupplyAllocation = 1;
      let TDESupplyAllocation = 2;
      let BountySupplyAllocation = 3;
      let WriterAccountSupplyAllocation = 4;
      let AdvisorySupplyAllocation = 5;
      let PlatformSupplyAllocation = 6;

      it("function() + buyTokens(): Test trickle down bonuses", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(cofounderA, cofounderB, platform, 0, {from: multisig, gas: gasAmount});

            // Deploy new tde contract
            const tde = await DNNTDE.new(token.address, cofounderA, cofounderB, multisig, 10, 0, 0, {from: multisig, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(tde.address, {from: cofounderA, gas: gasAmount});

            // Buy DNN
            await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});

            // Check total raise
            let fundsRaisedInWei = await tde.fundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(fundsRaisedInWei), 3, "Total funds raised should be 3 ETH");

            // Check tde raise
            let tdeFundsRaisedInWei = await tde.tdeFundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(tdeFundsRaisedInWei), 3, "TDE funds raised should be 3 ETH");

            // Check presale raise
            let presaleFundsRaisedInWei = await tde.presaleFundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(presaleFundsRaisedInWei), 0, "Presale funds raised should be 0 ETH");

            // Tokens issued for first bonus range
            let tokensIssuedForBonusRangeOne = await tde.tokensIssuedForBonusRangeOne.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(tokensIssuedForBonusRangeOne), 10800, "Tokens issued for bonus range one is 10800");

            // First bonus address count
            let bonusRangeOneAddressCount = await tde.bonusRangeOneAddressCount.call({from: cofounderA, gas: gasAmount});
            assert.equal(bonusRangeOneAddressCount, 1, "A single person contributed to bonus range one");

            // Buy DNN
            await web3.eth.sendTransaction({from: multisig, to: tde.address, gas: gasAmount, value: web3.toWei("2", "Ether")});

            // Tokens issued for second bonus range
            let tokensIssuedForBonusRangeTwo = await tde.tokensIssuedForBonusRangeTwo.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(tokensIssuedForBonusRangeTwo), 6900, "Tokens issued for bonus range two is 6900");

            // Second bonus address count
            let bonusRangeTwoAddressCount = await tde.bonusRangeTwoAddressCount.call({from: cofounderA, gas: gasAmount});
            assert.equal(bonusRangeTwoAddressCount, 1, "A single person contributed to bonus range two");

            // Buy DNN
            await web3.eth.sendTransaction({from: cofounderA, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});

            // Tokens issued for third bonus range
            let tokensIssuedForBonusRangeThree = await tde.tokensIssuedForBonusRangeThree.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(tokensIssuedForBonusRangeThree), 9900, "Tokens issued for bonus range three is 9900");

            // Third bonus address count
            let bonusRangeThreeAddressCount = await tde.bonusRangeThreeAddressCount.call({from: cofounderA, gas: gasAmount});
            assert.equal(bonusRangeThreeAddressCount, 1, "A single person contributed to bonus range three");

            // Buy DNN
            await web3.eth.sendTransaction({from: cofounderB, to: tde.address, gas: gasAmount, value: web3.toWei("2", "Ether")});

            // Tokens issued for fourth bonus range
            let tokensIssuedForBonusRangeFour = await tde.tokensIssuedForBonusRangeFour.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(tokensIssuedForBonusRangeFour), 6300, "Tokens issued for bonus range four is 6300");

            // Fourth bonus address count
            let bonusRangeFourAddressCount = await tde.bonusRangeFourAddressCount.call({from: cofounderA, gas: gasAmount});
            assert.equal(bonusRangeFourAddressCount, 1, "A single person contributed to bonus range four");

            // End PreTDE
            await tde.finalizePRETDE({from: cofounderA, gas: gasAmount});

            // End TDE
            await tde.finalizeTDE({from: cofounderA, gas: gasAmount});

            // Check if bonuses were released
            let trickleDownBonusesReleased = await tde.trickleDownBonusesReleased.call({from: cofounderA, gas: gasAmount});
            assert.equal(trickleDownBonusesReleased, true, "Trickle down bonuses should have been released");

            // Check if trickle down bonus was applied correctly
            let buyer_address_balance = await token.balanceOf.call(buyer_address, {from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(buyer_address_balance), 14040, "The token balance with the additional bounus 14040");

            // Check if trickle down bonus was applied correctly
            let multisig_balance = await token.balanceOf.call(buyer_address, {from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(multisig_balance), 7935, "The token balance with the additional bounus 7935");

            // Check if trickle down bonus was applied correctly
            let cofounderA_balance = await token.balanceOf.call(buyer_address, {from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(cofounderA_balance), 10395, "The token balance with the additional bounus 14040");

            // Check if trickle down bonus was applied correctly
            let cofounderB_balance = await token.balanceOf.call(buyer_address, {from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(cofounderB_balance), 6300, "The token balance with the additional bounus 14040");

      });

      it("extendPRETDE(): Test extending presale", async () => {

            let starts = 1552678073; // Friday, March 15, 2019 7:27:53 PM
            let ends = 1584300473; // Sunday, March 15, 2020 7:27:53 PM

            // Initialize token and tde contract
            const token = await DNNToken.new(cofounderA, cofounderB, platform, starts, {from: multisig, gas: gasAmount});
            const tde = await DNNTDE.new(token.address, cofounderA, cofounderB, multisig, 0, starts, ends, {from: multisig, gas: gasAmount});
            await token.changeCrowdfundContract(tde.address, {from: cofounderA, gas: gasAmount});

            let startDate = await tde.TDEStartDate({from: cofounderA, gas: gasAmount});
            assert.equal(startDate.toNumber(), starts, "The start date should be " + starts);

            // Move start date to end date
            await tde.extendPRETDE(ends, {from: cofounderA, gas: gasAmount});

            // Check if the start date is what we just set
            startDate = await tde.TDEStartDate({from: cofounderA, gas: gasAmount});
            assert.equal(startDate.toNumber(), ends, "The start date should be " + ends);

            // Check if the end date moved an equal distance from the new start date
            let endDate = await tde.TDEEndDate({from: cofounderA, gas: gasAmount});
            assert.equal(endDate.toNumber(), 1615922873, "The end date should be " + 1615922873);
      });

      it("finalizeTDE(): Ensures that PRETDE tokens do not remain locked", async () => {

            // Initialize token and tde contract
            const token = await DNNToken.new(cofounderA, cofounderB, platform, TDEStartDate, {from: multisig, gas: gasAmount});
            const tde = await DNNTDE.new(token.address, cofounderA, cofounderB, multisig, 0, TDEStartDate, TDEEndDate, {from: multisig, gas: gasAmount});
            await token.changeCrowdfundContract(tde.address, {from: cofounderA, gas: gasAmount});

            // Try to finalize TDE before PRETDE has been finalized
            try {
                await tde.finalizeTDE({from: cofounderA, gas: gasAmount});
            }
            catch(e) {
                ensureException(e);
            }

            // Check the pre-tde supply
            let PRETDESupplyRemaining = await token.PRETDESupplyRemaining({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(PRETDESupplyRemaining), 100000000, "Remaining PRE-TDE supply should be 100,000,000 tokens");

            // Finalize PRETDE
            await tde.finalizePRETDE({from: cofounderA, gas: gasAmount});

            // Try finalizing TDE again
            await tde.finalizeTDE({from: cofounderA, gas: gasAmount});

           PRETDESupplyRemaining = await token.PRETDESupplyRemaining({from: cofounderA, gas: gasAmount});
           assert.equal(PRETDESupplyRemaining.toNumber(), 0, "PRE-TDE supply should have no tokens left");

           TDESupplyRemaining = await token.TDESupplyRemaining({from: cofounderA, gas: gasAmount});
           assert.equal(TDESupplyRemaining.toNumber(), 0, "TDE supply should have no tokens left");

           let tokensDistributed = await tde.tokensDistributed({from: cofounderA, gas: gasAmount});
           assert.equal(WeiToETH(tokensDistributed), 500000000, "Tokens distributed should be the sum of PRETDE and TDE");
       });

      it("finalizeTDE() + unlockTokens(): Tests unlocking transfers before and after tde", async () => {

            // Initialize token and tde contract
            const token = await DNNToken.new(cofounderA, cofounderB, platform, TDEStartDate, {from: multisig, gas: gasAmount});
            const tde = await DNNTDE.new(token.address, cofounderA, cofounderB, multisig, 1 /* Ether */, TDEStartDate, TDEEndDate, {from: multisig, gas: gasAmount});
            await token.changeCrowdfundContract(tde.address, {from: cofounderA, gas: gasAmount});
            await tde.finalizePRETDE({from: cofounderA, gas: gasAmount});

            // Try unlocking the tokens by prematurely ending TDE
            try {
              await tde.finalizeTDE({from: cofounderA, gas: gasAmount});
            }
            catch (e) {
              ensureException(e);
            }

            // Check if tokens are still locked
            let tokensLocked =  await token.tokensLocked({from: cofounderA, gas: gasAmount});
            assert.equal(tokensLocked, true, "Tokens should be locked");

            // Attempt to transfer tokens while tokens are locked
            try {
                await token.transfer(cofounderA, ETHToWei(100), {from: buyer_address, gas: gasAmount})
            }
            catch (e) {
              ensureException(e);
            }

            // Make sure the token transfer failed
            let cofounderA_balance =  await token.balanceOf(cofounderA, {from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(cofounderA_balance), 0, "CofounderA should have 0 tokens");

            // Fill up TDE
            await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("1", "Ether")});

            // Attempt to finalize TDE
            try {
              await tde.finalizeTDE({from: cofounderA, gas: gasAmount});
            }
            catch (e) {
              ensureException(e);
            }

            // Check if tokens are still locked
            tokensLocked =  await token.tokensLocked({from: cofounderA, gas: gasAmount});
            assert.equal(tokensLocked, false, "Tokens should be unlocked");

            // Attempt to transfer tokens after sale
            try {
                await token.transfer(cofounderA, ETHToWei(100), {from: buyer_address, gas: gasAmount})
            }
            catch (e) {
              ensureException(e);
            }

            // Check balance
            cofounderA_balance =  await token.balanceOf(cofounderA, {from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(cofounderA_balance), 100, "CofounderA should have 100 tokens");
      });

      it("issuePRETDETokens() + buyPRETDETokensWithoutETH(): Tests pre-sale contribution with various contribution amounts", async () =>  {

              // Initialize tokens and tde contract (offset the start date and end date so we can test presale bonuses)
              const token = await DNNToken.new(cofounderA, cofounderB, platform, TDEStartDate, {from: multisig, gas: gasAmount});
              const tde = await DNNTDE.new(token.address, cofounderA, cofounderB, multisig, hardcap, nowPlusOrMinusYears(3), nowPlusOrMinusYears(4), {from: multisig, gas: gasAmount});
              await token.changeCrowdfundContract(tde.address, {from: cofounderA, gas: gasAmount});

              // Check pre-sale balance before issuing the buyer's tokens
              const PRETDESupplyRemaining_one = await token.PRETDESupplyRemaining.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(PRETDESupplyRemaining_one), 100000000, "Remaining pre-tde balance should be 100,000,000 tokens");

              // Attempt to purchase tokens using an amount lower than presale minimum
              try {
                await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("4", "Ether")});
              }
              catch (e) {
                ensureException(e);
              }

              // Check to see if the transaction failed
              let buyerA_ETH_contribution = await tde.contributorETHBalance(buyer_address, {from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(buyerA_ETH_contribution), 0, "The total contribution of this buyer should be 0 ETH");

              // Buy at first pre-tde range
              await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("100", "Ether")});

              // Issue tokens
              await tde.issuePRETDETokens(buyer_address, {from: cofounderA, gas: gasAmount});

              // Buy at next range
              await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("200", "Ether")});

              // Try  purchasing tokens before tokens have been issued to this pre-tde contributor
              try {
                await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("200", "Ether")});
              }
              catch(e) {
                ensureException(e);
              }

              // Issue tokens
              await tde.issuePRETDETokens(buyer_address, {from: cofounderA, gas: gasAmount});

              // Buy at next range
              await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("301", "Ether")});

              // Issue tokens
              await tde.issuePRETDETokens(buyer_address, {from: cofounderA, gas: gasAmount});

              // Check total ETH given by buyer
              buyerA_ETH_contribution = await tde.contributorETHBalance(buyer_address, {from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(buyerA_ETH_contribution), 601, "The total contribution of this buyer should be 601 ETH");

              // Check token balance of buyer after third bonus purchase
              const buyerA_balance_one = await token.balanceOf(buyer_address, {from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(buyerA_balance_one), 2374050, "The buyer should have a 2,374,050 token balance");

              // Manually buy tokens
              await tde.buyPRETDETokensWithoutETH(buyer_address, ETHToWei(5), ETHToWei(100000), {from: cofounderA, gas: gasAmount});

              // Check token balance of buyer after release of tokens
              const buyerA_balance_two = await token.balanceOf.call(buyer_address, {from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(buyerA_balance_two), 2474050, "The buyer should have a 2,474,050 token balance");

              // Release tokens to pre-sale contributor
              const PRETDESupplyRemaining_two = await token.PRETDESupplyRemaining.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(PRETDESupplyRemaining_two), 97525950, "Remaining pre-tde balance should be 97,525,950 tokens");

              // Check total tokens distributed from contract
              let tokensDistributed = await tde.tokensDistributed.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(tokensDistributed), 2474050, "The total tokens distributed should be 2,474,050");

              // Try to give tokens to a user who hasn't purchased presale tokens
              try {
                tokensReleased = await tde.issuePRETDETokens(cofounderA, {from: cofounderA, gas: gasAmount});
              }
              catch (e) {
                ensureException(e);
              }

              // Make sure token issuance failed
              tokensDistributed = await tde.tokensDistributed.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(tokensDistributed), 2474050, "The total tokens distributed should be 2,474,050");

              // Try to assign tokens manually by a non-cofounder
              try {
                await tde.buyPRETDETokensWithoutETH(buyer_address, ETHToWei(5), ETHToWei(100000), {from: buyer_address, gas: gasAmount});
              }
              catch (e) {
                ensureException(e);
              }

              // Try buying more tokens than the entire pre-tde and tde supplies combined
              try {
                await tde.buyPRETDETokensWithoutETH(buyer_address, ETHToWei(5), ETHToWei(600000000), {from: buyer_address, gas: gasAmount});
              }
              catch (e) {
                ensureException(e);
              }

              // Make sure token issuance failed
              tokensDistributed = await tde.tokensDistributed.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(tokensDistributed), 2474050, "The total tokens distributed should be 2,474,050");

              // Try to issue more tokens than the supply of presale tokens
              await tde.buyPRETDETokensWithoutETH(buyer_address, ETHToWei(5), ETHToWei(200000000), {from: cofounderA, gas: gasAmount});

              // Make sure token issuance failed
              tokensDistributed = await tde.tokensDistributed.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(tokensDistributed), 202474050, "The total tokens distributed should be 202,474,050");

              const PRETDESupplyRemaining_three = await token.PRETDESupplyRemaining.call({from: cofounderA, gas: gasAmount});
              const TDESupplyRemaining_one = await token.TDESupplyRemaining.call({from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(PRETDESupplyRemaining_three), 0, "The remaining pre-TDE balance should be 0");
              assert.equal(WeiToETH(TDESupplyRemaining_one), 297525950, "The remaining TDE balance should be 297,525,950");

      });

      it("issueTokens(): Tests issuances of allocations not involving PRE-TDE and TDE", async () => {

              // Create token and tde. Unlock tokens to test issuing tokens after sale
              const token = await DNNToken.new(cofounderA, cofounderB, platform, TDEStartDate, {from: multisig, gas: gasAmount});
              const tde = await DNNTDE.new(token.address, cofounderA, cofounderB, multisig, 0, TDEStartDate, TDEEndDate, {from: multisig, gas: gasAmount});
              await token.changeCrowdfundContract(tde.address, {from: cofounderA, gas: gasAmount});
              await token.changeAllocator(cofounderA, {from: cofounderA, gas: gasAmount});
              await tde.finalizePRETDE({from: cofounderA, gas: gasAmount});
              await tde.finalizeTDE({from: cofounderA, gas: gasAmount});


              // Test issuing tokens to ADVISIORY
              await token.issueTokens(advisory, ETHToWei(100000), AdvisorySupplyAllocation, {from: cofounderA, gas: gasAmount});
              const advisory_balance = await token.balanceOf(advisory, {from: advisory, gas: gasAmount});
              assert.equal(WeiToETH(advisory_balance), 100000, "The advisory should have 100,000 tokens");
              const advisory_supply_balance = await token.advisorySupplyRemaining.call({from: advisory, gas: gasAmount});
              assert.equal(WeiToETH(advisory_supply_balance), 139900000, "The advisory allocation remaining should be 139,900,000 tokens");

              // Test sending more than advisory supply allocation has
              try {
                  await token.issueTokens(earlyBacker, ETHToWei(140000000), EarlyBackerSupplyAllocation, {from: cofounderA, gas: gasAmount});
              }
              catch (e) {
                ensureException(e);
              }

              // Test issuing tokens to EARLY BACKERS
              await token.issueTokens(earlyBacker, ETHToWei(100000), EarlyBackerSupplyAllocation, {from: cofounderA, gas: gasAmount});
              const earlyBacker_balance = await token.balanceOf(earlyBacker, {from: earlyBacker, gas: gasAmount});
              assert.equal(WeiToETH(earlyBacker_balance), 100000, "The early backer should have 100,000 tokens");
              const earlyBacker_supply_balance = await token.earlyBackerSupplyRemaining.call({from: earlyBacker, gas: gasAmount});
              assert.equal(WeiToETH(earlyBacker_supply_balance), 99900000, "The early backer allocation remaining should be 99,900,000 tokens");


              // Test issuing tokens to WRITER ACCOUNTS
              await token.issueTokens(writerAccount, ETHToWei(100000), WriterAccountSupplyAllocation, {from: cofounderA, gas: gasAmount});
              const writerAccount_balance = await token.balanceOf(writerAccount, {from: writerAccount, gas: gasAmount});
              assert.equal(WeiToETH(writerAccount_balance), 100000, "The writer account should have 100,000 tokens");
              const writerAccount_supply_balance = await token.writerAccountSupplyRemaining.call({from: writerAccount, gas: gasAmount});
              assert.equal(WeiToETH(writerAccount_supply_balance), 39900000, "The writer account allocation remaining should be 39,900,000 tokens");

              // Test issuing tokens to BOUNTY CONTRIBUTORS
              await token.issueTokens(bountyContributor, ETHToWei(100000), BountySupplyAllocation, {from: cofounderA, gas: gasAmount});
              const bountyContributor_balance = await token.balanceOf(bountyContributor, {from: bountyContributor, gas: gasAmount});
              assert.equal(WeiToETH(bountyContributor_balance), 100000, "The bounty should have 100,000 tokens");
              const bountyContributor_supply_balance = await token.bountySupplyRemaining.call({from: bountyContributor, gas: gasAmount});
              assert.equal(WeiToETH(bountyContributor_supply_balance), 9900000, "The bounty allocation remaining should be 9,900,000 tokens");

              // Test issuing tokens to PLATFORM
              await token.issueTokens(user_address, ETHToWei(100000), PlatformSupplyAllocation, {from: platform, gas: gasAmount});
              const user_balance = await token.balanceOf(user_address, {from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(user_balance), 100000, "The user should have 100,000 tokens");
              const platform_supply_balance = await token.platformSupplyRemaining.call({from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(platform_supply_balance), 609900000, "The platform allocation remaining should be 609,900,000 tokens");

      })

      it("sendUnsoldPRETDETokensToTDE(): Tests moving remaining PRE-TDE tokens to TDE remaining supply", async () => {

              // Deploy new token contract
              const token = await DNNToken.new(cofounderA, cofounderB, platform, TDEStartDate, {from: multisig, gas: gasAmount});

              // Set allocator
              await token.changeCrowdfundContract(cofounderA, {from: cofounderA, gas: gasAmount});

              // Move tokens to TDE
              await token.sendUnsoldPRETDETokensToTDE({from: cofounderA, gas: gasAmount});

              // Check remaining supply of PRE-TDE
              let PRETDESupplyRemaining_balance = await token.PRETDESupplyRemaining.call({from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(PRETDESupplyRemaining_balance), 0, "The PRE-TDE supply should be 0");

              // Check remaining supply of TDE
              let TDESupplyRemaining_balance = await token.TDESupplyRemaining.call({from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(TDESupplyRemaining_balance), 500000000, "The TDE supply should be 500,000,000");
      });

      it("sendUnsoldTDETokensToPlatform(): Tests moving remaining TDE tokens to Platform remaining supply", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(cofounderA, cofounderB, platform, TDEStartDate, {from: multisig, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(cofounderA, {from: cofounderA, gas: gasAmount});

            // Move tokens to Platform
            await token.sendUnsoldTDETokensToPlatform({from: cofounderA, gas: gasAmount});

            // Check remaining supply of PRE-TDE
            let TDESupplyRemaining_balance = await token.TDESupplyRemaining.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(TDESupplyRemaining_balance), 0, "The TDE supply should be 0");

            // Check remaining supply of TDE
            let platformSupplyRemaining_balance = await token.platformSupplyRemaining.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(platformSupplyRemaining_balance), 510000000, "The Platform supply should be 510,000,000");
      });

      it("function() + buyTokens(): Tests whether contract allows contributions that exceed goal", async () => {

              // Deploy new token contract
              const token = await DNNToken.new(cofounderA, cofounderB, platform, TDEStartDate, {from: multisig, gas: gasAmount});

              // Deploy new tde contract
              const tde = await DNNTDE.new(token.address, cofounderA, cofounderB, multisig, 10, TDEStartDate, TDEEndDate, {from: multisig, gas: gasAmount});

              // Set allocator
              await token.changeCrowdfundContract(tde.address, {from: cofounderA, gas: gasAmount});

              // Attempt to send more ETH than goal
              try {
                  await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("11", "Ether")});
              }
              catch (e) {
                ensureException(e);
              }

               // Contract balance
               let tde_raised  = await tde.fundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
               assert.equal(WeiToETH(tde_raised), 0, "Total funds raised should be 0 ETH");

               // Send equivalent of goal
               await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("10", "Ether")});

               tde_raised   = await tde.fundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
               let tde_hardcap  = await tde.maximumFundingGoalInETH.call({from: cofounderA, gas: gasAmount});
               assert.equal(WeiToETH(tde_raised), 10, "Total funds raised should be 10 ETH");
               assert.equal(WeiToETH(tde_hardcap) == WeiToETH(tde_raised), true, "The goal should be reached");

      });

      it("function() + buyTokens(): accepts 1 ETH in exchange for DNN tokens during TDE at varies raises", async () =>  {

            // Deploy new token contract
            const token = await DNNToken.new(cofounderA, cofounderB, platform, TDEStartDate, {from: multisig, gas: gasAmount});

            // Deploy new tde contract (GOAL 10 Ether)
            const tde = await DNNTDE.new(token.address, cofounderA, cofounderB, multisig, 10, TDEStartDate, TDEEndDate, {from: multisig, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(tde.address, {from: cofounderA, gas: gasAmount});

            // Check initial balance token balance buyer
            const buyerA_balance_one = await token.balanceOf.call(buyer_address, {from: buyer_address, gas: gasAmount});
            assert.equal(WeiToETH(buyerA_balance_one), 0, "The buyer should start with a 0 token balance");

            // Buy tokens at first token rate --> 20%
            await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});

           // Check balance after first token purchase --> 20%
           const buyerA_balance_two = await token.balanceOf.call(buyer_address, {from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(buyerA_balance_two), 10800, "The buyer should start with a 10800 token balance");

           // Send more to reach next token rate --> 15%
           await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("2", "Ether")});

           // Check balance after second token purchase --> 15%
           const buyerA_balance_three = await token.balanceOf.call(buyer_address, {from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(buyerA_balance_three), 17700, "The buyer should have an additional 17700 tokens");

           // Buy tokens at next token rate 10%
           await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("3", "Ether")});

           // Check balance after third token purchase 10%
           const buyerA_balance_four = await token.balanceOf.call(buyer_address, {from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(buyerA_balance_four), 27600, "The buyer have an additional 27600 tokens");

           // Buy tokens at next token rate 5%
           await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("2", "Ether")});

           // Check balance after third token purchase 5%
           const buyerA_balance_five = await token.balanceOf.call(buyer_address, {from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(buyerA_balance_five), 33900, "The buyer have an additional 33900 tokens");

          // Check total tokens distributed from contract
           const tokensDistributed = await tde.tokensDistributed.call({from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(tokensDistributed), 33900, "The total tokens distributed should be 33900");

           // Check buyer's total ETH contribution balance
           const buyerA_ETH_contribution = await tde.contributorETHBalance.call(buyer_address, {from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(buyerA_ETH_contribution), 10, "The total contribution of this buyer should be 10 ETH");

           // Check total balance of contract
           const fundsRaisedInWei = await tde.fundsRaisedInWei.call({from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(fundsRaisedInWei), 10, "The balance of the contract should be 10 ETH");

           // Check if available TDE supply has been properly reduced
           const TDESupplyRemaining = await token.TDESupplyRemaining.call({from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(TDESupplyRemaining), 399966100, "Remaining TDE balance should be 399,966,100 tokens");

      });

      it("changeCofounderA() + changeCofounderB() + changeDNNHoldingMultisig(): Tests changing addresses", async () => {

        // Deploy new token contract
        const token = await DNNToken.new(cofounderA, cofounderB, platform, TDEStartDate, {from: multisig, gas: gasAmount});

        // Deploy new tde contract
        const tde = await DNNTDE.new(token.address, cofounderA, cofounderB, multisig, 0, TDEStartDate, TDEEndDate, {from: multisig, gas: gasAmount});

        // Change allocator (token contract)
        await token.changeCrowdfundContract(tde.address, {from: cofounderA, gas: gasAmount});

        let allocator = await token.crowdfundContract.call();
        assert.equal(allocator == tde.address, true, "Crowdfund Contract should be TDE address");

        // Try to change the contract address while TDE is going on
        try {
            await token.changeCrowdfundContract(cofounderA, {from: cofounderA, gas: gasAmount});
        }
        catch (e) {
            ensureException(e);
        }

        // Check to see if the allocator has been changed
        allocator = await token.crowdfundContract.call();
        assert.equal(allocator == tde.address, true, "Allocator should be TDE address");

        // Finalize PRE-ICO
        //await tde.finalizePRETDE({from: cofounderA, gas: gasAmount});

        // Unlock tokens
        //await tde.finalizeTDE({from: cofounderA, gas: gasAmount});

        // Try to change the allocator
        await token.changeAllocator(cofounderA, {from: cofounderA, gas: gasAmount});

        // Check to see if the allocator has been changed
        allocator = await token.allocatorAddress.call();
        assert.equal(allocator == cofounderA, true, "Allocator should be cofounder A address");

        // Change cofounders (token contract)
        await token.changeCofounderA(cofounderB, {from: cofounderA, gas: gasAmount});
        let _cofounderA = await token.cofounderA.call();
        assert.equal(_cofounderA == cofounderB, true, "CofounderA should have changed");

        await token.changeCofounderB(cofounderA, {from: cofounderB, gas: gasAmount});
        let _cofounderB = await token.cofounderB.call();
        assert.equal(_cofounderB == cofounderA, true, "CofounderB should have changed");

        // Change cofounders (tde contract)
        await tde.changeCofounderA(cofounderB, {from: cofounderA, gas: gasAmount});
        _cofounderA = await tde.cofounderA.call();
        assert.equal(_cofounderA == cofounderB, true, "CofounderA should have changed");

        await tde.changeCofounderB(cofounderA, {from: cofounderB, gas: gasAmount});
        _cofounderB = await tde.cofounderB.call();
        assert.equal(_cofounderB == cofounderA, true, "CofounderB should have changed");

        // Change DNN Multisig (tde contract)
        await tde.changeDNNHoldingMultisig(multisig, {from: cofounderA, gas: gasAmount});
        await tde.changeDNNHoldingMultisig(platform, {from: cofounderA, gas: gasAmount});
        let _multisig = await tde.dnnHoldingMultisig.call();
        assert.equal(_multisig == platform, true, "DNN Multisig should have changed");

      });

      it("finalizePRETDE() + finalizeTDE() + unlockTokens(): Tests ending PRE-TDE and TDE", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(cofounderA, cofounderB, platform, TDEStartDate, {from: multisig, gas: gasAmount});

            // Deploy new tde contract
            const tde = await DNNTDE.new(token.address, cofounderA, cofounderB, multisig, 10, 0, 0, {from: multisig, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(tde.address, {from: cofounderA, gas: gasAmount});

            // End PRE-TDE
            await tde.finalizePRETDE({from: cofounderA, gas: gasAmount});

            let TDESupplyRemaining_balance = await token.TDESupplyRemaining.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(TDESupplyRemaining_balance), 500000000, "The TDE supply should be 500,000,000");

            // Contribute to TDE
            await web3.eth.sendTransaction({from: buyer_address, to: tde.address, gas: gasAmount, value: web3.toWei("10", "Ether")});

            // Contract balance
            let tde_raised  = await tde.fundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(tde_raised), 10, "Total funds raised should be 10 ETH");

            // Fast forward to end of sale
            progressTimeBySeconds(3600 * 24 * 31 * 37);

            // End TDE
            await tde.finalizeTDE({from: cofounderA, gas: gasAmount});

            // Check platform supply
            //let platformSupplyRemaining_balance = await token.platformSupplyRemaining.call({from: cofounderA, gas: gasAmount});
            //assert.equal(WeiToETH(platformSupplyRemaining_balance), 609946000, "The Platform supply should be 609946000");


      });

      it("issueCofoundersTokensIfPossible(): Tests cofounder vesting schedule", async () => {

              // Deploy new token contract
              const token = await DNNToken.new(cofounderA, cofounderB, platform, 0, {from: multisig, gas: gasAmount});

              // Fetch cofounder supply
              let cofoundersSupply = await token.cofoundersSupply.call({from: cofounderA, gas: gasAmount});

              // Fetch vesting interval count
              let cofoundersSupplyVestingTranches = await token.cofoundersSupplyVestingTranches.call();

              // Attempt to widthdraw tokens every month for 10 months
              for (var month=1; month <= 10; month++)
              {
                  progressTimeBySeconds(3600 * 24 * 31);
                  await token.issueCofoundersTokensIfPossible({from: cofounderA, gas: gasAmount});

                  // Try to issue tokens prior to next month
                  try {
                    await token.issueCofoundersTokensIfPossible({from: cofounderA, gas: gasAmount});
                  }
                  catch (e) {
                    ensureException(e);
                  }

                  let cofoundersSupplyVestingTranchesIssued = await token.cofoundersSupplyVestingTranchesIssued.call();
                  let cofoundersSupplyDistributed = await token.cofoundersSupplyDistributed.call();
                  assert.equal(cofoundersSupplyVestingTranchesIssued.toNumber(), month, (month) + " Month(s) should have been issued");
              }

              // Try to withdraw tokens out beyond 10 months
              try
              {
                  await token.issueCofoundersTokensIfPossible({from: cofounderA, gas: gasAmount});
              }
              catch (e) {
                ensureException(e);
              }

              // Each founder should have a total of 50,000,000 tokens each after 10 months
              let cofounderA_balance =  await token.balanceOf(cofounderA, {from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(cofounderA_balance), 50000000, "CofounderA should get 50,000,000 tokens this month");

              let cofounderB_balance =  await token.balanceOf(cofounderB, {from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(cofounderA_balance), 50000000, "CofounderB should get 50,000,000 tokens this month");

      })

});
