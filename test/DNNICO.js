// Deployed contracts
let DNNICO = artifacts.require("./DNNICO.sol");
let DNNToken = artifacts.require("./DNNToken.sol");
let BigNumber = require('bignumber.js');

contract("DNNICO", function(accounts) {

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

      let hardcap = 100000
      let gasAmount = 3000000;
      let buyer_address = accounts[8];
      let user_address = accounts[9];
      let ICOStartDate = nowPlusOrMinusYears(0);
      let ICOEndDate = nowPlusOrMinusYears(3);

      let EarlyBackerSupplyAllocation = 0;
      let PREICOSupplyAllocation = 1;
      let ICOSupplyAllocation = 2;
      let BountySupplyAllocation = 3;
      let WriterAccountSupplyAllocation = 4;
      let AdvisorySupplyAllocation = 5;
      let PlatformSupplyAllocation = 6;

      it("finalizeICO(): Ensures that PREICO tokens do not remain locked", async () => {

            // Initialize token and ico contract
            const token = await DNNToken.new(cofounderA, cofounderB, platform, ICOStartDate, {from: multisig, gas: gasAmount});
            const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, 0, ICOStartDate, ICOEndDate, {from: multisig, gas: gasAmount});
            await token.changeCrowdfundContract(ico.address, {from: cofounderA, gas: gasAmount});

            // Try to finalize ICO before PREICO has been finalized
            try {
                await ico.finalizeICO({from: cofounderA, gas: gasAmount});
            }
            catch(e) {
                ensureException(e);
            }

            // Check the pre-ico supply
            let PREICOSupplyRemaining = await token.PREICOSupplyRemaining({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(PREICOSupplyRemaining), 100000000, "Remaining Pre-ico supply should be 100,000,000 tokens");

            // Finalize PREICO
            await ico.finalizePREICO({from: cofounderA, gas: gasAmount});

            // Try finalizing ICO again
            await ico.finalizeICO({from: cofounderA, gas: gasAmount});

           PREICOSupplyRemaining = await token.PREICOSupplyRemaining({from: cofounderA, gas: gasAmount});
           assert.equal(PREICOSupplyRemaining.toNumber(), 0, "Pre-ico supply should have no tokens left");

           ICOSupplyRemaining = await token.ICOSupplyRemaining({from: cofounderA, gas: gasAmount});
           assert.equal(ICOSupplyRemaining.toNumber(), 0, "ICO supply should have no tokens left");

           let tokensDistributed = await ico.tokensDistributed({from: cofounderA, gas: gasAmount});
           assert.equal(WeiToETH(tokensDistributed), 500000000, "Tokens distributed should be the sum of PREICO and ICO");
       });

      it("finalizeICO() + unlockTokens(): Tests unlocking transfers before and after ico", async () => {

            // Initialize token and ico contract
            const token = await DNNToken.new(cofounderA, cofounderB, platform, ICOStartDate, {from: multisig, gas: gasAmount});
            const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, 1 /* Ether */, ICOStartDate, ICOEndDate, {from: multisig, gas: gasAmount});
            await token.changeCrowdfundContract(ico.address, {from: cofounderA, gas: gasAmount});
            await ico.finalizePREICO({from: cofounderA, gas: gasAmount});

            // Try unlocking the tokens by prematurely ending ICO
            try {
              await ico.finalizeICO({from: cofounderA, gas: gasAmount});
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

            // Fill up ICO
            await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("1", "Ether")});

            // Attempt to finalize ICO
            try {
              await ico.finalizeICO({from: cofounderA, gas: gasAmount});
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

      it("issuePREICOTokens() + buyPREICOTokensWithoutETH(): Tests pre-sale contribution with various contribution amounts", async () =>  {

              // Initialize tokens and ico contract (offset the start date and end date so we can test presale bonuses)
              const token = await DNNToken.new(cofounderA, cofounderB, platform, ICOStartDate, {from: multisig, gas: gasAmount});
              const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, hardcap, nowPlusOrMinusYears(3), nowPlusOrMinusYears(4), {from: multisig, gas: gasAmount});
              await token.changeCrowdfundContract(ico.address, {from: cofounderA, gas: gasAmount});

              // Check pre-sale balance before issuing the buyer's tokens
              const PREICOSupplyRemaining_one = await token.PREICOSupplyRemaining.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(PREICOSupplyRemaining_one), 100000000, "Remaining pre-ico balance should be 100,000,000 tokens");

              // Attempt to purchase tokens using an amount lower than presale minimum
              try {
                await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("99", "Ether")});
              }
              catch (e) {
                ensureException(e);
              }

              // Check to see if the transaction failed
              let buyerA_ETH_contribution = await ico.contributorETHBalance(buyer_address, {from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(buyerA_ETH_contribution), 0, "The total contribution of this buyer should be 0 ETH");

              // Buy at first pre-ico range
              await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("100", "Ether")});

              // Issue tokens
              await ico.issuePREICOTokens(buyer_address, {from: cofounderA, gas: gasAmount});

              // Buy at next range
              await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("200", "Ether")});

              // Try  purchasing tokens before tokens have been issued to this pre-ico contributor
              try {
                await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("200", "Ether")});
              }
              catch(e) {
                ensureException(e);
              }

              // Issue tokens
              await ico.issuePREICOTokens(buyer_address, {from: cofounderA, gas: gasAmount});

              // Buy at next range
              await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("301", "Ether")});

              // Issue tokens
              await ico.issuePREICOTokens(buyer_address, {from: cofounderA, gas: gasAmount});

              // Check total ETH given by buyer
              buyerA_ETH_contribution = await ico.contributorETHBalance(buyer_address, {from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(buyerA_ETH_contribution), 601, "The total contribution of this buyer should be 601 ETH");

              // Check token balance of buyer after third bonus purchase
              const buyerA_balance_one = await token.balanceOf(buyer_address, {from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(buyerA_balance_one), 2193750, "The buyer should have a 2,193,750 token balance");

              // Manually buy tokens
              await ico.buyPREICOTokensWithoutETH(buyer_address, ETHToWei(5), ETHToWei(100000), {from: cofounderA, gas: gasAmount});

              // Check token balance of buyer after release of tokens
              const buyerA_balance_two = await token.balanceOf.call(buyer_address, {from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(buyerA_balance_two), 2293750, "The buyer should have a 2,293,750 token balance");

              // Release tokens to pre-sale contributor
              const PREICOSupplyRemaining_two = await token.PREICOSupplyRemaining.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(PREICOSupplyRemaining_two), 97706250, "Remaining pre-ico balance should be 97,706,250 tokens");

              // Check total tokens distributed from contract
              let tokensDistributed = await ico.tokensDistributed.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(tokensDistributed), 2293750, "The total tokens distributed should be 2,293,750");

              // Try to give tokens to a user who hasn't purchased presale tokens
              try {
                tokensReleased = await ico.issuePREICOTokens(cofounderA, {from: cofounderA, gas: gasAmount});
              }
              catch (e) {
                ensureException(e);
              }

              // Make sure token issuance failed
              tokensDistributed = await ico.tokensDistributed.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(tokensDistributed), 2293750, "The total tokens distributed should be 2,293,750");

              // Try to assign tokens manually by a non-cofounder
              try {
                await ico.buyPREICOTokensWithoutETH(buyer_address, ETHToWei(5), ETHToWei(100000), {from: buyer_address, gas: gasAmount});
              }
              catch (e) {
                ensureException(e);
              }

              // Try buying more tokens than the entire pre-ico and ico supplies combined
              try {
                await ico.buyPREICOTokensWithoutETH(buyer_address, ETHToWei(5), ETHToWei(600000000), {from: buyer_address, gas: gasAmount});
              }
              catch (e) {
                ensureException(e);
              }

              // Make sure token issuance failed
              tokensDistributed = await ico.tokensDistributed.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(tokensDistributed), 2293750, "The total tokens distributed should be 2,293,750");

              // Try to issue more tokens than the supply of presale tokens
              await ico.buyPREICOTokensWithoutETH(buyer_address, ETHToWei(5), ETHToWei(200000000), {from: cofounderA, gas: gasAmount});

              // Make sure token issuance failed
              tokensDistributed = await ico.tokensDistributed.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(tokensDistributed), 202293750, "The total tokens distributed should be 202,293,750");

              const PREICOSupplyRemaining_three = await token.PREICOSupplyRemaining.call({from: cofounderA, gas: gasAmount});
              const ICOSupplyRemaining_one = await token.ICOSupplyRemaining.call({from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(PREICOSupplyRemaining_three), 0, "The remaining pre-ICO balance should be 0");
              assert.equal(WeiToETH(ICOSupplyRemaining_one), 297706250, "The remaining ICO balance should be 297,706,250");

      });

      it("issueTokens(): Tests issuances of allocations not involving PRE-ICO and ICO", async () => {

              // Create token and ico. Unlock tokens to test issuing tokens after sale
              const token = await DNNToken.new(cofounderA, cofounderB, platform, ICOStartDate, {from: multisig, gas: gasAmount});
              const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, 0, ICOStartDate, ICOEndDate, {from: multisig, gas: gasAmount});
              await token.changeCrowdfundContract(ico.address, {from: cofounderA, gas: gasAmount});
              await token.changeAllocator(cofounderA, {from: cofounderA, gas: gasAmount});
              await ico.finalizePREICO({from: cofounderA, gas: gasAmount});
              await ico.finalizeICO({from: cofounderA, gas: gasAmount});


              // Test issuing tokens to ADVISIORY
              await token.issueTokens(advisory, ETHToWei(100000), AdvisorySupplyAllocation, {from: cofounderA, gas: gasAmount});
              const advisory_balance = await token.balanceOf(advisory, {from: advisory, gas: gasAmount});
              assert.equal(WeiToETH(advisory_balance), 100000, "The advisory should have 100,000 tokens");
              const advisory_supply_balance = await token.advisorySupplyRemaining.call({from: advisory, gas: gasAmount});
              assert.equal(WeiToETH(advisory_supply_balance), 119900000, "The advisory allocation remaining should be 119,900,000 tokens");

              // Test sending more than a supply allocation has
              try {
                  await token.issueTokens(earlyBacker, ETHToWei(120000000), EarlyBackerSupplyAllocation, {from: cofounderA, gas: gasAmount});
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
              assert.equal(WeiToETH(platform_supply_balance), 629900000, "The platform allocation remaining should be 629,900,000 tokens");

      })

      it("sendUnsoldPREICOTokensToICO(): Tests moving remaining PRE-ICO tokens to ICO remaining supply", async () => {

              // Deploy new token contract
              const token = await DNNToken.new(cofounderA, cofounderB, platform, ICOStartDate, {from: multisig, gas: gasAmount});

              // Set allocator
              await token.changeCrowdfundContract(cofounderA, {from: cofounderA, gas: gasAmount});

              // Move tokens to ICO
              await token.sendUnsoldPREICOTokensToICO({from: cofounderA, gas: gasAmount});

              // Check remaining supply of PRE-ICO
              let PREICOSupplyRemaining_balance = await token.PREICOSupplyRemaining.call({from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(PREICOSupplyRemaining_balance), 0, "The PRE-ICO supply should be 0");

              // Check remaining supply of ICO
              let ICOSupplyRemaining_balance = await token.ICOSupplyRemaining.call({from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(ICOSupplyRemaining_balance), 500000000, "The ICO supply should be 500,000,000");
      });

      it("sendUnsoldICOTokensToPlatform(): Tests moving remaining ICO tokens to Platform remaining supply", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(cofounderA, cofounderB, platform, ICOStartDate, {from: multisig, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(cofounderA, {from: cofounderA, gas: gasAmount});

            // Move tokens to Platform
            await token.sendUnsoldICOTokensToPlatform({from: cofounderA, gas: gasAmount});

            // Check remaining supply of PRE-ICO
            let ICOSupplyRemaining_balance = await token.ICOSupplyRemaining.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(ICOSupplyRemaining_balance), 0, "The ICO supply should be 0");

            // Check remaining supply of ICO
            let platformSupplyRemaining_balance = await token.platformSupplyRemaining.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(platformSupplyRemaining_balance), 530000000, "The Platform supply should be 530,000,000");
      });

      it("function() + buyTokens(): Tests whether contract allows contributions that exceed goal", async () => {

              // Deploy new token contract
              const token = await DNNToken.new(cofounderA, cofounderB, platform, ICOStartDate, {from: multisig, gas: gasAmount});

              // Deploy new ico contract
              const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, 10, ICOStartDate, ICOEndDate, {from: multisig, gas: gasAmount});

              // Set allocator
              await token.changeCrowdfundContract(ico.address, {from: cofounderA, gas: gasAmount});

              // Attempt to send more ETH than goal
              try {
                  await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("11", "Ether")});
              }
              catch (e) {
                ensureException(e);
              }

               // Contract balance
               let ico_raised  = await ico.fundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
               assert.equal(WeiToETH(ico_raised), 0, "Total funds raised should be 0 ETH");

               // Send equivalent of goal
               await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("10", "Ether")});

               ico_raised   = await ico.fundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
               let ico_hardcap  = await ico.maximumFundingGoalInETH.call({from: cofounderA, gas: gasAmount});
               assert.equal(WeiToETH(ico_raised), 10, "Total funds raised should be 10 ETH");
               assert.equal(WeiToETH(ico_hardcap) == WeiToETH(ico_raised), true, "The goal should be reached");

      });

      it("function() + buyTokens(): accepts 1 ETH in exchange for DNN tokens during ICO at varies times", async () =>  {

            // Deploy new token contract
            const token = await DNNToken.new(cofounderA, cofounderB, platform, ICOStartDate, {from: multisig, gas: gasAmount});

            // Deploy new ico contract
            const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, hardcap, ICOStartDate, ICOEndDate, {from: multisig, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(ico.address, {from: cofounderA, gas: gasAmount});

            // Check initial balance token balance buyer
            const buyerA_balance_one = await token.balanceOf.call(buyer_address, {from: buyer_address, gas: gasAmount});
            assert.equal(WeiToETH(buyerA_balance_one), 0, "The buyer should start with a 0 token balance");

            // Buy tokens at first bonus range
            await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("1", "Ether")});

           // Check balance after first token purchase
           const buyerA_balance_two = await token.balanceOf.call(buyer_address, {from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(buyerA_balance_two), 3300, "The buyer should start with a 3300 token balance - First 48 hour bonus");

           // Progress time to after 48 hours
           progressTimeBySeconds(3600 * 49);

           // Buy tokens at second bonus range
           await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("1", "Ether")});

           // Check balance after second token purchase
           const buyerA_balance_three = await token.balanceOf.call(buyer_address, {from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(buyerA_balance_three) - WeiToETH(buyerA_balance_two), 3150, "The buyer should have an additional 3150 tokens - After 48 hour bonus");

           // Progress time to after 1 week to test next bonus range
           progressTimeBySeconds(3600 * 24 * 8);

           // Buy tokens at third bonus range
           await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("1", "Ether")});

           // Check balance after third token purchase
           const buyerA_balance_four = await token.balanceOf.call(buyer_address, {from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(buyerA_balance_four) - WeiToETH(buyerA_balance_three), 3000, "The buyer have an additional 3000 tokens - After Week 1 bonus");

          // Check total tokens distributed from contract
           const tokensDistributed = await ico.tokensDistributed.call({from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(tokensDistributed), 9450, "The total tokens distributed should be 9450");

           // Check buyer's total ETH contribution balance
           const buyerA_ETH_contribution = await ico.contributorETHBalance.call(buyer_address, {from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(buyerA_ETH_contribution), 3, "The total contribution of this buyer should be 3 ETH");

           // Check total balance of contract
           const fundsRaisedInWei = await ico.fundsRaisedInWei.call({from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(fundsRaisedInWei), 3, "The balance of the contract should be 3 ETH");

           // Check if available ICO supply has been properly reduced (40% of 1 billion tokens  - 9450 tokens sold)
           const ICOSupplyRemaining = await token.ICOSupplyRemaining.call({from: buyer_address, gas: gasAmount});
           assert.equal(WeiToETH(ICOSupplyRemaining), 399990550, "Remaining ICO balance should be 399,990,550 tokens");

      });

      it("changeCofounderA() + changeCofounderB() + changeDNNHoldingMultisig(): Tests changing addresses", async () => {

        // Deploy new token contract
        const token = await DNNToken.new(cofounderA, cofounderB, platform, ICOStartDate, {from: multisig, gas: gasAmount});

        // Deploy new ico contract
        const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, 0, ICOStartDate, ICOEndDate, {from: multisig, gas: gasAmount});

        // Change allocator (token contract)
        await token.changeCrowdfundContract(ico.address, {from: cofounderA, gas: gasAmount});

        let allocator = await token.crowdfundContract.call();
        assert.equal(allocator == ico.address, true, "Crowdfund Contract should be ICO address");

        // Try to change the contract address while ICO is going on
        try {
            await token.changeCrowdfundContract(cofounderA, {from: cofounderA, gas: gasAmount});
        }
        catch (e) {
            ensureException(e);
        }

        // Check to see if the allocator has been changed
        allocator = await token.crowdfundContract.call();
        assert.equal(allocator == ico.address, true, "Allocator should be ICO address");

        // Finalize PRE-ICo
        await ico.finalizePREICO({from: cofounderA, gas: gasAmount});

        // Unlock tokens
        await ico.finalizeICO({from: cofounderA, gas: gasAmount});

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

        // Change cofounders (ico contract)
        await ico.changeCofounderA(cofounderB, {from: cofounderA, gas: gasAmount});
        _cofounderA = await ico.cofounderA.call();
        assert.equal(_cofounderA == cofounderB, true, "CofounderA should have changed");

        await ico.changeCofounderB(cofounderA, {from: cofounderB, gas: gasAmount});
        _cofounderB = await ico.cofounderB.call();
        assert.equal(_cofounderB == cofounderA, true, "CofounderB should have changed");

        // Change DNN Multisig (ico contract)
        await ico.changeDNNHoldingMultisig(multisig, {from: cofounderA, gas: gasAmount});
        await ico.changeDNNHoldingMultisig(platform, {from: cofounderA, gas: gasAmount});
        let _multisig = await ico.dnnHoldingMultisig.call();
        assert.equal(_multisig == platform, true, "DNN Multisig should have changed");

      });

      it("finalizePREICO() + finalizeICO() + unlockTokens(): Tests ending PRE-ICO and ICO", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(cofounderA, cofounderB, platform, ICOStartDate, {from: multisig, gas: gasAmount});

            // Deploy new ico contract
            const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, 10, 0, 0, {from: multisig, gas: gasAmount});

            // Set allocator
            await token.changeCrowdfundContract(ico.address, {from: cofounderA, gas: gasAmount});

            // End PRE-ICO
            await ico.finalizePREICO({from: cofounderA, gas: gasAmount});

            let ICOSupplyRemaining_balance = await token.ICOSupplyRemaining.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(ICOSupplyRemaining_balance), 500000000, "The ICO supply should be 500,000,000");

            // Contribute to ICO
            await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("10", "Ether")});

            // Contract balance
            let ico_raised  = await ico.fundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(ico_raised), 10, "Total funds raised should be 10 ETH");

            // Fast forward to end of sale
            progressTimeBySeconds(3600 * 24 * 31 * 37);

            // End ICO
            await ico.finalizeICO({from: cofounderA, gas: gasAmount});

            // Check platform supply
            let platformSupplyRemaining_balance = await token.platformSupplyRemaining.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(platformSupplyRemaining_balance), 629967000, "The Platform supply should be 629,967,000");


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
