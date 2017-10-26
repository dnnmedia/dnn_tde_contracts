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

      // Constants
      let multisig = accounts[0];
      let cofounderA = accounts[1];
      let cofounderB = accounts[2];
      let advisory = accounts[3];
      let writerAccount = accounts[4];
      let earlyBacker = accounts[5];
      let bountyContributor = accounts[6];
      let platform = accounts[7];

      let hardcap = 100000 * Math.pow(10, 18);
      let gasAmount = 3000000;
      let buyer_address = accounts[8];
      let ICOStartDate = nowPlusOrMinusYears(0);
      let ICOEndDate = nowPlusOrMinusYears(3);

      let EarlyBackerSupplyAllocation = 0;
      let PREICOSupplyAllocation = 1;
      let ICOSupplyAllocation = 2;
      let BountySupplyAllocation = 3;
      let WriterAccountSupplyAllocation = 4;
      let AdvisorySupplyAllocation = 5;
      let CofoundersSupplyAllocation = 6;
      let PlatformSupplyAllocation = 7;

      it("Tests unlocking transfers", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(cofounderA, cofounderB, ICOStartDate, {from: multisig, gas: gasAmount});

            // Deploy new ico contract
            const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, ETHToWei(1), ICOStartDate, ICOEndDate, {from: multisig, gas: gasAmount});

            // Change allocator (token contract)
            await token.changeAllocator(ico.address, {from: cofounderA, gas: gasAmount});

            // Fill up ICO
            await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("1", "Ether")});

            // Attempt to transfer tokens while sale is going on
            try {
                await token.transfer(cofounderA, ETHToWei(100), {from: buyer_address, gas: gasAmount})
            }
            catch(e) {};

            // Make sure the token transfer failed
            let cofounderA_balance =  await token.balanceOf(cofounderA, {from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(cofounderA_balance), 0, "CofounderA should have 0 tokens");

            // End ICO
            await ico.finalizeICO({from: cofounderA, gas: gasAmount});

            // Attempt to transfer tokens again
            await token.transfer(cofounderA, ETHToWei(100), {from: buyer_address, gas: gasAmount})

            // Check balance
            cofounderA_balance =  await token.balanceOf(cofounderA, {from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(cofounderA_balance), 100, "CofounderA should have 100 tokens");
      });

      it("function() + issuePREICOTokens: Tests pre-sale contribution with various contribution amounts", async () =>  {

              // Deploy new token contract
              const token = await DNNToken.new(cofounderA, cofounderB, ICOStartDate, {from: multisig, gas: gasAmount});

              // Deploy new ico contract (offset the start date and end date so we can test presale bonuses)
              const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, hardcap, nowPlusOrMinusYears(3), nowPlusOrMinusYears(4), {from: multisig, gas: gasAmount});

              // Set allocator
              await token.changeAllocator(ico.address, {from: cofounderA, gas: gasAmount});

              // Attempt to purchase tokens at every presale range
              await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("100", "Ether")});
              await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("200", "Ether")});
              await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("301", "Ether")});

              // Check total ETH given by buyer
              const buyerA_ETH_contribution = await ico.contributorETHBalance(buyer_address, {from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(buyerA_ETH_contribution), 601, "The total contribution of this buyer should be 601 ETH");

              // Check token balance of buyer after third bonus purchase
              const buyerA_balance_one = await token.balanceOf(buyer_address, {from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(buyerA_balance_one), 0, "The buyer should have a 0 token balance");

              // Check pre-sale balance before issuing the buyer's tokens
              const PREICOSupplyRemaining_one = await token.PREICOSupplyRemaining.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(PREICOSupplyRemaining_one), 100000000, "Remaining pre-ico balance should be 100,000,000 tokens");

              // Amount of tokens buyer is entitled to
              const buyerA_token_entitlement = await ico.calculateTokens.call(ETHToWei(601), nowPlusOrMinusYears(0), {from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(buyerA_token_entitlement), 2253750, "The buyer is entitled to a balance of 2,253,750 tokens");

              // Release tokens that buyer is entitled to
              const tokensReleased = await ico.issuePREICOTokens(buyer_address, {from: cofounderA, gas: gasAmount});
              assert.equal(Boolean(tokensReleased), true, "Tokens should have been released to buyer");

              // Manually buy tokens
              await ico.buyPREICOTokensWithoutETH(buyer_address, ETHToWei(5), ETHToWei(100000), {from: cofounderA, gas: gasAmount});

              // Check token balance of buyer after release of tokens
              const buyerA_balance_two = await token.balanceOf.call(buyer_address, {from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(buyerA_balance_two), 2353750, "The buyer should have a 2,353,750 token balance");

              // Release tokens to pre-sale contributor
              const PREICOSupplyRemaining_two = await token.PREICOSupplyRemaining.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(PREICOSupplyRemaining_two), 97646250, "Remaining pre-ico balance should be 97,646,250 tokens");

              // Check total tokens distributed from contract
              const tokensDistributed = await ico.tokensDistributed.call({from: buyer_address, gas: gasAmount});
              assert.equal(WeiToETH(tokensDistributed), 2353750, "The total tokens distributed should be 2,353,750");

      });

      it("function(): accepts 1 ETH in exchange for DNN tokens during ICO at varies times", async () =>  {

            // Deploy new token contract
            const token = await DNNToken.new(cofounderA, cofounderB, ICOStartDate, {from: multisig, gas: gasAmount});

            // Deploy new ico contract
            const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, hardcap, ICOStartDate, ICOEndDate, {from: multisig, gas: gasAmount});

            // Set allocator
            await token.changeAllocator(ico.address, {from: cofounderA, gas: gasAmount});

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

      it("Tests issuances of allocations not involving PRE-ICO and ICO", async () => {

              // Deploy new token contract
              const token = await DNNToken.new(cofounderA, cofounderB, ICOStartDate, {from: multisig, gas: gasAmount});

              // Deploy new ico contract
              const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, hardcap, ICOStartDate, ICOEndDate, {from: multisig, gas: gasAmount});

              // Set allocator
              await token.changeAllocator(cofounderA, {from: cofounderA, gas: gasAmount});

              // Send tokens to advisory, check advisory's balance, and then remaining advisory tokens
              await token.issueTokens(advisory, ETHToWei(100000), AdvisorySupplyAllocation, {from: cofounderA, gas: gasAmount});

              const advisory_balance = await token.balanceOf(advisory, {from: advisory, gas: gasAmount});
              assert.equal(WeiToETH(advisory_balance), 100000, "The advisory should have 100,000 tokens");

              const advisory_supply_balance = await token.advisorySupplyRemaining.call({from: advisory, gas: gasAmount});
              assert.equal(WeiToETH(advisory_supply_balance), 119900000, "The advisory allocation remaining should be 119,900,000 tokens");


              // Send tokens to early backers
              await token.issueTokens(earlyBacker, ETHToWei(100000), EarlyBackerSupplyAllocation, {from: cofounderA, gas: gasAmount});

              const earlyBacker_balance = await token.balanceOf(earlyBacker, {from: earlyBacker, gas: gasAmount});
              assert.equal(WeiToETH(earlyBacker_balance), 100000, "The early backer should have 100,000 tokens");

              const earlyBacker_supply_balance = await token.earlyBackerSupplyRemaining.call({from: earlyBacker, gas: gasAmount});
              assert.equal(WeiToETH(earlyBacker_supply_balance), 99900000, "The early backer allocation remaining should be 99,900,000 tokens");


              // Send tokens to writer account
              await token.issueTokens(writerAccount, ETHToWei(100000), WriterAccountSupplyAllocation, {from: cofounderA, gas: gasAmount});

              const writerAccount_balance = await token.balanceOf(writerAccount, {from: writerAccount, gas: gasAmount});
              assert.equal(WeiToETH(writerAccount_balance), 100000, "The writer account should have 100,000 tokens");

              const writerAccount_supply_balance = await token.writerAccountSupplyRemaining.call({from: writerAccount, gas: gasAmount});
              assert.equal(WeiToETH(writerAccount_supply_balance), 39900000, "The writer account allocation remaining should be 39,900,000 tokens");


              // Send tokens to bounty
              await token.issueTokens(bountyContributor, ETHToWei(100000), BountySupplyAllocation, {from: cofounderA, gas: gasAmount});

              const bountyContributor_balance = await token.balanceOf(bountyContributor, {from: bountyContributor, gas: gasAmount});
              assert.equal(WeiToETH(bountyContributor_balance), 100000, "The bounty should have 100,000 tokens");

              const bountyContributor_supply_balance = await token.bountySupplyRemaining.call({from: bountyContributor, gas: gasAmount});
              assert.equal(WeiToETH(bountyContributor_supply_balance), 9900000, "The bounty allocation remaining should be 9,900,000 tokens");

      })

      it("Tests moving remaining PRE-ICO tokens to ICO remaining supply", async () => {

              // Deploy new token contract
              const token = await DNNToken.new(cofounderA, cofounderB, ICOStartDate, {from: multisig, gas: gasAmount});

              // Set allocator
              await token.changeAllocator(cofounderA, {from: cofounderA, gas: gasAmount});

              // Move tokens to ICO
              await token.sendUnsoldPREICOTokensToICO({from: cofounderA, gas: gasAmount});

              // Check remaining supply of PRE-ICO
              let PREICOSupplyRemaining_balance = await token.PREICOSupplyRemaining.call({from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(PREICOSupplyRemaining_balance), 0, "The PRE-ICO supply should be 0");

              // Check remaining supply of ICO
              let ICOSupplyRemaining_balance = await token.ICOSupplyRemaining.call({from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(ICOSupplyRemaining_balance), 500000000, "The ICO supply should be 500,000,000");
      });

      it("Tests moving remaining ICO tokens to Platform remaining supply", async () => {

                // Deploy new token contract
                const token = await DNNToken.new(cofounderA, cofounderB, ICOStartDate, {from: multisig, gas: gasAmount});

                // Set allocator
                await token.changeAllocator(cofounderA, {from: cofounderA, gas: gasAmount});

                // Move tokens to Platform
                await token.sendUnsoldICOTokensToPlatform({from: cofounderA, gas: gasAmount});

                // Check remaining supply of PRE-ICO
                let ICOSupplyRemaining_balance = await token.ICOSupplyRemaining.call({from: cofounderA, gas: gasAmount});
                assert.equal(WeiToETH(ICOSupplyRemaining_balance), 0, "The ICO supply should be 0");

                // Check remaining supply of ICO
                let platformSupplyRemaining_balance = await token.platformSupplyRemaining.call({from: cofounderA, gas: gasAmount});
                assert.equal(WeiToETH(platformSupplyRemaining_balance), 530000000, "The Platform supply should be 530,000,000");
        });

      it("Tests whether contract allows contributions that exceed goal", async () => {

              // Deploy new token contract
              const token = await DNNToken.new(cofounderA, cofounderB, ICOStartDate, {from: multisig, gas: gasAmount});

              // Deploy new ico contract
              const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, ETHToWei(10), ICOStartDate, ICOEndDate, {from: multisig, gas: gasAmount});

              // Set allocator
              await token.changeAllocator(ico.address, {from: cofounderA, gas: gasAmount});

              // Attempt to send more ETH than goal
              try
              {
                  await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("11", "Ether")});
              }
              catch(e)
              {
                  assert.equal(true, true, "ETH contribution should not exceed hardcap")
              }

               // Contract balance
               let ico_balance = await web3.eth.getBalance(ico.address)
               let ico_raised  = await ico.fundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
               assert.equal(WeiToETH(ico_balance), 0, "Total ETH in contract should be 0");
               assert.equal(WeiToETH(ico_raised), 0, "Total funds raised should be 0 ETH");

               // Send equivalent of goal
               await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("10", "Ether")});

               ico_balance  = await web3.eth.getBalance(ico.address)
               ico_raised   = await ico.fundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
               let ico_hardcap  = await ico.maximumFundingGoalInWei.call({from: cofounderA, gas: gasAmount});
               assert.equal(WeiToETH(ico_balance), 10, "Total ETH in contract should be 10");
               assert.equal(WeiToETH(ico_raised), 10, "Total funds raised should be 10 ETH");
               assert.equal(WeiToETH(ico_hardcap) == WeiToETH(ico_raised), true, "The goal should be reached");

      });

      it("Tests cofounder vesting schedule", async () => {

              // Deploy new token contract
              const token = await DNNToken.new(cofounderA, cofounderB, ICOStartDate, {from: multisig, gas: gasAmount});

              // Fetch cofounder supply
              let cofoundersSupply = await token.cofoundersSupply.call({from: cofounderA, gas: gasAmount});

              // Fetch vesting interval count
              let cofoundersSupplyVestingIntervals = await token.cofoundersSupplyVestingIntervals.call({from: cofounderA, gas: gasAmount});

              // Attempt to widthdraw tokens every month for 10 months
              for (var month=10; month >= 1; month--)
              {
                  progressTimeBySeconds(3600 * 24 * 31);
                  await token.issueCofoundersTokensIfPossible({from: cofounderA, gas: gasAmount});

                  let cofoundersSupplyRemaining = await token.cofoundersSupplyRemaining.call({from: cofounderA, gas: gasAmount});
                  let remainingMonths = cofoundersSupplyRemaining.dividedBy(cofoundersSupply.dividedBy(cofoundersSupplyVestingIntervals))
                  assert.equal(remainingMonths.toNumber(), month-1, (month-1) + " Month(s) should be remaining for cofounders to withdraw tokens");
              }

              // Try to withdraw tokens out beyond 10 months
              try
              {
                  await token.issueCofoundersTokensIfPossible({from: cofounderA, gas: gasAmount});
              }
              catch(e)
              {
                  assert.equal(true, true, "Tokens can be issued beyond 10 months");
              }

              // Each founder should have a total of 50,000,000 tokens each after 10 months
              let cofounderA_balance =  await token.balanceOf(cofounderA, {from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(cofounderA_balance), 50000000, "CofounderA should get 50,000,000 tokens this month");

              let cofounderB_balance =  await token.balanceOf(cofounderB, {from: cofounderA, gas: gasAmount});
              assert.equal(WeiToETH(cofounderA_balance), 50000000, "CofounderB should get 50,000,000 tokens this month");

      })

      it("Tests ending PRE-ICO and ICO", async () => {

            // Deploy new token contract
            const token = await DNNToken.new(cofounderA, cofounderB, ICOStartDate, {from: multisig, gas: gasAmount});

            // Deploy new ico contract
            const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, hardcap, ICOStartDate, ICOEndDate, {from: multisig, gas: gasAmount});

            // Set allocator
            await token.changeAllocator(ico.address, {from: cofounderA, gas: gasAmount});

            // End PRE-ICO
            await ico.finalizePREICO({from: cofounderA, gas: gasAmount});

            let ICOSupplyRemaining_balance = await token.ICOSupplyRemaining.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(ICOSupplyRemaining_balance), 500000000, "The ICO supply should be 500,000,000");

            // Contribute to ICO
            await web3.eth.sendTransaction({from: buyer_address, to: ico.address, gas: gasAmount, value: web3.toWei("5", "Ether")});

            // Contract balance
            let ico_balance = await web3.eth.getBalance(ico.address)
            let ico_raised  = await ico.fundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(ico_balance), 5, "Total ETH in contract should be 5");
            assert.equal(WeiToETH(ico_raised), 5, "Total funds raised should be 5 ETH");

            // Fast forward to end of sale
            progressTimeBySeconds(3600 * 24 * 31 * 37);

            // End ICO
            await ico.finalizeICO({from: cofounderA, gas: gasAmount});

            // Check balance after ending
            ico_balance = await web3.eth.getBalance(ico.address)
            ico_raised  = await ico.fundsRaisedInWei.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(ico_balance), 0, "Total ETH in contract should be 0");
            assert.equal(WeiToETH(ico_raised), 5, "Total funds raised should be 5 ETH");

            // Check platform supply
            let platformSupplyRemaining_balance = await token.platformSupplyRemaining.call({from: cofounderA, gas: gasAmount});
            assert.equal(WeiToETH(platformSupplyRemaining_balance), 629985000, "The Platform supply should be 629,985,000");

      });

      it("Tests changing addresses", async () => {

        // Deploy new token contract
        const token = await DNNToken.new(cofounderA, cofounderB, ICOStartDate, {from: multisig, gas: gasAmount});

        // Deploy new ico contract
        const ico = await DNNICO.new(token.address, cofounderA, cofounderB, multisig, hardcap, ICOStartDate, ICOEndDate, {from: multisig, gas: gasAmount});

        // Change allocator (token contract)
        await token.changeAllocator(ico.address, {from: cofounderA, gas: gasAmount});
        await token.changeAllocator(cofounderA, {from: cofounderA, gas: gasAmount});
        let allocator = await token.allocator.call();
        assert.equal(allocator == cofounderA, true, "Allocator should be cofounderA");

        // Change cofounders (token contract)
        await token.changeCofounderA(cofounderB, {from: cofounderA, gas: gasAmount});
        let _cofounderA = await token.cofounderA.call();
        assert.equal(_cofounderA == cofounderB, true, "CofounderA should have changed");

        await token.changeCofounderB(cofounderA, {from: cofounderB, gas: gasAmount});
        let _cofounderB = await token.cofounderB.call();
        assert.equal(_cofounderB == cofounderA, true, "CofounderB should have changed");

        // Change Platform (token contract)
        await token.changePlatform(multisig, {from: cofounderA, gas: gasAmount});
        await token.changePlatform(platform, {from: cofounderA, gas: gasAmount});
        let _platform = await token.platform.call();
        assert.equal(_platform == platform, true, "Platform should have changed");

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

});
