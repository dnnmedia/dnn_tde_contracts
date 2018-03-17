pragma solidity ^0.4.11;


import './libraries/math/SafeMath.sol';
import './DNNToken.sol';

/// @title DNNTDE contract - Takes funds from users and issues tokens.
/// @author Dondrey Taylor - <dondrey@dnn.media>
contract DNNTDE {

    using SafeMath for uint256;

    /////////////////////////
    // DNN Token Contract  //
    /////////////////////////
    DNNToken public dnnToken;

    //////////////////////////////////////////
    // Addresses of the co-founders of DNN. //
    //////////////////////////////////////////
    address public cofounderA;
    address public cofounderB;

    ///////////////////////////
    // DNN Holding Multisig //
    //////////////////////////
    address public dnnHoldingMultisig;

    ///////////////////////////
    // Start date of the TDE //
    ///////////////////////////
    uint256 public TDEStartDate;  // Epoch

    /////////////////////////
    // End date of the TDE //
    /////////////////////////
    uint256 public TDEEndDate;  // Epoch

    /////////////////////////////////
    // Amount of atto-DNN per wei //
    /////////////////////////////////
    uint256 public tokenExchangeRateBase = 3000; // 1 Wei = 3000 atto-DNN

    /////////////////////////////////////////////////
    // Number of tokens distributed (in atto-DNN) //
    /////////////////////////////////////////////////
    uint256 public tokensDistributed = 0;

    ///////////////////////////////////////////////
    // Minumum Contributions for pre-TDE and TDE //
    ///////////////////////////////////////////////
    uint256 public minimumTDEContributionInWei = 0.001 ether;
    uint256 public minimumPRETDEContributionInWei = 5 ether;

    //////////////////////
    // Funding Hard cap //
    //////////////////////
    uint256 public maximumFundingGoalInETH;

    //////////////////
    // Funds Raised //
    //////////////////
    uint256 public fundsRaisedInWei = 0;
    uint256 public presaleFundsRaisedInWei = 0;
    uint256 public tdeFundsRaisedInWei = 0;

    ////////////////////////////////////////////
    // Keep track of Wei contributed per user //
    ////////////////////////////////////////////
    mapping(address => uint256) ETHContributions;

    ////////////////////////////////////////////////
    // Keeps track of tokens per eth contribution //
    ////////////////////////////////////////////////
    mapping(address => uint256) ETHContributorTokens;


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Keeps track of pre-tde contributors and how many tokens they are entitled to get based on their contribution //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    mapping(address => uint256) PRETDEContributorTokensPendingRelease;
    uint256 PRETDEContributorsTokensPendingCount = 0; // keep track of contributors waiting for tokens
    uint256 TokensPurchasedDuringPRETDE = 0; // keep track of how many tokens need to be issued to presale contributors


    //////////////////
    // Bonus ranges //
    //////////////////
    bool public trickleDownBonusesReleased = false;
    uint256 public rangeETHAmount = 0;
    uint256 public bonusRangeCount = 4;

    uint256 public tokensIssuedForBonusRangeOne    = 0;
    uint256 public tokensIssuedForBonusRangeTwo    = 0;
    uint256 public tokensIssuedForBonusRangeThree  = 0;
    uint256 public tokensIssuedForBonusRangeFour   = 0;

    uint256 public bonusRangeOneAddressCount   = 0;
    uint256 public bonusRangeTwoAddressCount   = 0;
    uint256 public bonusRangeThreeAddressCount = 0;
    uint256 public bonusRangeFourAddressCount  = 0;

    mapping(uint256 => address) bonusRangeOne;   // 20%
    mapping(uint256 => address) bonusRangeTwo;   // 15%
    mapping(uint256 => address) bonusRangeThree; // 10%
    mapping(uint256 => address) bonusRangeFour;  // 5%

    //////////////////////////////////////////////////////
    // Checks if trickle down bonuses not been released //
    //////////////////////////////////////////////////////
    modifier HasTrickleDownBonusesNotBeenReleased() {
        require (trickleDownBonusesReleased == false);
        _;
    }

    ///////////////////////////////////////////////////////////////////
    // Checks if all pre-tde contributors have received their tokens //
    ///////////////////////////////////////////////////////////////////
    modifier NoPRETDEContributorsAwaitingTokens() {
        // Determine if all pre-tde contributors have received tokens
        require(PRETDEContributorsTokensPendingCount == 0);
        _;
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    // Checks if there are any pre-tde contributors that have not recieved their tokens  //
    ///////////////////////////////////////////////////////////////////////////////////////
    modifier PRETDEContributorsAwaitingTokens() {

        // Determine if there pre-tde contributors that have not received tokens
        require(PRETDEContributorsTokensPendingCount > 0);

        _;
    }

    ////////////////////////////////////////////////////
    // Checks if CoFounders are performing the action //
    ////////////////////////////////////////////////////
    modifier onlyCofounders() {
        require (msg.sender == cofounderA || msg.sender == cofounderB);
        _;
    }

    ////////////////////////////////////////////////////
    // Checks if CoFounder A is performing the action //
    ////////////////////////////////////////////////////
    modifier onlyCofounderA() {
        require (msg.sender == cofounderA);
        _;
    }

    ////////////////////////////////////////////////////
    // Checks if CoFounder B is performing the action //
    ////////////////////////////////////////////////////
    modifier onlyCofounderB() {
        require (msg.sender == cofounderB);
        _;
    }

    ////////////////////////////////s
    // Check if the tde has ended //
    ////////////////////////////////
    modifier TDEHasEnded() {
       require (now >= TDEEndDate || fundsRaisedInWei >= maximumFundingGoalInETH);
       _;
    }

    //////////////////////////////////////////////////////////////////////////////
    // Checksto see if the contribution is at least the minimum allowed for tde //
    //////////////////////////////////////////////////////////////////////////////
    modifier ContributionIsAtLeastMinimum() {
        require (msg.value >= minimumTDEContributionInWei);
        _;
    }

    ///////////////////////////////////////////////////////////////
    // Make sure max cap is not exceeded with added contribution //
    ///////////////////////////////////////////////////////////////
    modifier ContributionDoesNotCauseGoalExceedance() {
       uint256 newFundsRaised = msg.value+fundsRaisedInWei;
       require (newFundsRaised <= maximumFundingGoalInETH);
       _;
    }

    ///////////////////////////////////////////////////////////////
    // Make sure max cap is not exceeded with added contribution //
    ///////////////////////////////////////////////////////////////
    modifier TDETokensLeft() {
       uint256 tokensDistributedPlusBonuses = tokensIssuedForBonusRangeOne.mul(150).div(100) + tokensIssuedForBonusRangeTwo.mul(130).div(100) + tokensIssuedForBonusRangeThree.mul(115).div(100) + tokensIssuedForBonusRangeFour.mul(105).div(100);
       require (tokensDistributedPlusBonuses < dnnToken.TDESupplyRemaining());
       _;
    }

    /////////////////////////////////////////////////////////////////
    // Check if the specified beneficiary has sent us funds before //
    /////////////////////////////////////////////////////////////////
    modifier HasPendingPRETDETokens(address _contributor) {
        require (PRETDEContributorTokensPendingRelease[_contributor] !=  0);
        _;
    }

    /////////////////////////////////////////////////////////////
    // Check if pre-tde contributors is not waiting for tokens //
    /////////////////////////////////////////////////////////////
    modifier IsNotAwaitingPRETDETokens(address _contributor) {
        require (PRETDEContributorTokensPendingRelease[_contributor] ==  0);
        _;
    }

    ///////////////////////////////////////////////////////
    //  @des Function to change founder A address.       //
    //  @param newAddress Address of new founder A.      //
    ///////////////////////////////////////////////////////
    function changeCofounderA(address newAddress)
        onlyCofounderA
    {
        cofounderA = newAddress;
    }

    //////////////////////////////////////////////////////
    //  @des Function to change founder B address.      //
    //  @param newAddress Address of new founder B.     //
    //////////////////////////////////////////////////////
    function changeCofounderB(address newAddress)
        onlyCofounderB
    {
        cofounderB = newAddress;
    }

    ////////////////////////////////////////
    //  @des Function to extend tde       //
    //  @param new crowdsale start date   //
    ////////////////////////////////////////
    function extendTDE(uint256 endDate)
        onlyCofounders
        returns (bool)
    {
        // Make sure that the new date is past the existing date and
        // is not in the past.
        if (endDate > now && endDate > TDEEndDate) {
            TDEEndDate = endDate;
            return true;
        }

        return false;
    }

    ////////////////////////////////////////
    //  @des Function to extend pre-tde   //
    //  @param new crowdsale start date   //
    ////////////////////////////////////////
    function extendPRETDE(uint256 startDate)
        onlyCofounders
        returns (bool)
    {
        // Make sure that the new date is past the existing date and
        // is not in the past.
        if (startDate > now && startDate > TDEStartDate) {
            TDEEndDate = TDEEndDate + (startDate-TDEStartDate); // Move end date the same amount of days as start date
            TDEStartDate = startDate; // set new start date
            return true;
        }

        return false;
    }

    //////////////////////////////////////////////////////
    //  @des Function to change multisig address.       //
    //  @param newAddress Address of new multisig.      //
    //////////////////////////////////////////////////////
    function changeDNNHoldingMultisig(address newAddress)
        onlyCofounders
    {
        dnnHoldingMultisig = newAddress;
    }

    //////////////////////////////////////////
    // @des ETH balance of each contributor //
    //////////////////////////////////////////
    function contributorETHBalance(address _owner)
      constant
      returns (uint256 balance)
    {
        return ETHContributions[_owner];
    }

    ////////////////////////////////////////////////////////////
    // @des Determines if an address is a pre-TDE contributor //
    ////////////////////////////////////////////////////////////
    function isAwaitingPRETDETokens(address _contributorAddress)
       internal
       returns (bool)
    {
        return PRETDEContributorTokensPendingRelease[_contributorAddress] > 0;
    }

    /////////////////////////////////////////////////////////////
    // @des Returns pending presale tokens for a given address //
    /////////////////////////////////////////////////////////////
    function getPendingPresaleTokens(address _contributor)
        constant
        returns (uint256)
    {
        return PRETDEContributorTokensPendingRelease[_contributor];
    }

    ////////////////////////////////
    // @des Returns current bonus //
    ////////////////////////////////
    function getCurrentTDEBonus()
        constant
        returns (uint256)
    {
        return getTDETokenExchangeRate(now);
    }


    ////////////////////////////////
    // @des Returns current bonus //
    ////////////////////////////////
    function getCurrentPRETDEBonus()
        constant
        returns (uint256)
    {
        return getPRETDETokenExchangeRate(now);
    }

    ///////////////////////////////////////////////////////////////////////
    // @des Returns bonus (in atto-DNN) per wei for the specific moment //
    // @param timestamp Time of purchase (in seconds)                    //
    ///////////////////////////////////////////////////////////////////////
    function getTDETokenExchangeRate(uint256 timestamp)
        constant
        returns (uint256)
    {
        // No bonus - TDE ended
        if (timestamp > TDEEndDate) {
            return uint256(0);
        }

        // No bonus - TDE has not started
        if (TDEStartDate > timestamp) {
            return uint256(0);
        }

        // Bonus One --> 0 - 25% of raise
        if (tdeFundsRaisedInWei <= rangeETHAmount) {
            return tokenExchangeRateBase.mul(120).div(100);
        }
        // Bonus Two --> 25% - 50% of raise
        else if (tdeFundsRaisedInWei > rangeETHAmount && tdeFundsRaisedInWei <= rangeETHAmount.mul(2)) {
            return tokenExchangeRateBase.mul(115).div(100);
        }
        // Bonus Three --> 50% - 75% of raise
        else if (tdeFundsRaisedInWei > rangeETHAmount.mul(2) && tdeFundsRaisedInWei <= rangeETHAmount.mul(3)) {
            return tokenExchangeRateBase.mul(110).div(100);
        }
        // Bonus Four --> 75% - 100% of raise
        else if (tdeFundsRaisedInWei > rangeETHAmount.mul(3) && tdeFundsRaisedInWei <= maximumFundingGoalInETH) {
            return tokenExchangeRateBase.mul(105).div(100);
        }
        else {
            return tokenExchangeRateBase;
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////
    // @des Returns bonus (in atto-DNN) per wei for the specific contribution amount //
    // @param weiamount The amount of wei being contributed                           //
    ////////////////////////////////////////////////////////////////////////////////////
    function getPRETDETokenExchangeRate(uint256 weiamount)
        constant
        returns (uint256)
    {
        // Presale will only accept contributions above minimum
        if (weiamount < minimumPRETDEContributionInWei) {
            return uint256(0);
        }

        // Minimum Contribution - 199 ETH (25% Bonus)
        if (weiamount >= minimumPRETDEContributionInWei && weiamount <= 199 ether) {
            return tokenExchangeRateBase + tokenExchangeRateBase.mul(25).div(100);

        // 200 ETH - 300 ETH Bonus (30% Bonus)
        } else if (weiamount >= 200 ether && weiamount <= 300 ether) {
            return tokenExchangeRateBase + tokenExchangeRateBase.mul(30).div(100);

        // 301 ETH - 2665 ETH Bonus (35% Bonus)
        } else if (weiamount >= 301 ether && weiamount <= 2665 ether) {
            return tokenExchangeRateBase + tokenExchangeRateBase.mul(35).div(100);

        // 2666+ ETH Bonus (50% Bonus)
        } else {
            return tokenExchangeRateBase + tokenExchangeRateBase.mul(50).div(100);
        }
    }

    //////////////////////////////////////////////////////////////////////////////////////////
    // @des Computes how many tokens a buyer is entitled to based on contribution and time. //
    //////////////////////////////////////////////////////////////////////////////////////////
    function calculateTokens(uint256 weiamount, uint256 timestamp)
        constant
        returns (uint256)
    {

        // Compute how many atto-DNN user is entitled to.
        uint256 computedTokensForPurchase = weiamount.mul(timestamp >= TDEStartDate ? getTDETokenExchangeRate(timestamp) : getPRETDETokenExchangeRate(weiamount));

        // Amount of atto-DNN to issue
        return computedTokensForPurchase;
     }


    ///////////////////////////////////////////////////////////////
    // @des Issues tokens for users who made purchase with ETH   //
    // @param beneficiary Address the tokens will be issued to.  //
    // @param weiamount ETH amount (in Wei)                      //
    // @param timestamp Time of purchase (in seconds)            //
    ///////////////////////////////////////////////////////////////
    function buyTokens()
        internal
        ContributionIsAtLeastMinimum
        ContributionDoesNotCauseGoalExceedance
        TDETokensLeft
        returns (bool)
    {
        // Determine how many tokens should be issued
        uint256 tokenCount = calculateTokens(msg.value, now);

        // Before adding the contributor to a bonus range
        // make sure that this is the first time they have contributed
        if (ETHContributorTokens[msg.sender] == 0) {
            // Bonus One
            if (tdeFundsRaisedInWei <= rangeETHAmount) {
                tokensIssuedForBonusRangeOne = tokensIssuedForBonusRangeOne.add(tokenCount);
                bonusRangeOne[bonusRangeOneAddressCount] = msg.sender;
                bonusRangeOneAddressCount = bonusRangeOneAddressCount.add(1);
            }
            // Bonus Two
            else if (tdeFundsRaisedInWei > rangeETHAmount && tdeFundsRaisedInWei <= rangeETHAmount.mul(2)) {
                tokensIssuedForBonusRangeTwo = tokensIssuedForBonusRangeTwo.add(tokenCount);
                bonusRangeTwo[bonusRangeTwoAddressCount] = msg.sender;
                bonusRangeTwoAddressCount = bonusRangeTwoAddressCount.add(1);
            }
            // Bonus Three
            else if (tdeFundsRaisedInWei > rangeETHAmount.mul(2) && tdeFundsRaisedInWei <= rangeETHAmount.mul(3)) {
                tokensIssuedForBonusRangeThree = tokensIssuedForBonusRangeThree.add(tokenCount);
                bonusRangeThree[bonusRangeThreeAddressCount] = msg.sender;
                bonusRangeThreeAddressCount = bonusRangeThreeAddressCount.add(1);
            }
            // Bonus Four
            else if (tdeFundsRaisedInWei > rangeETHAmount.mul(3) && tdeFundsRaisedInWei <= maximumFundingGoalInETH) {
                tokensIssuedForBonusRangeFour = tokensIssuedForBonusRangeFour.add(tokenCount);
                bonusRangeFour[bonusRangeFourAddressCount] = msg.sender;
                bonusRangeFourAddressCount = bonusRangeFourAddressCount.add(1);
            }
        }

        // Update total amount of tokens distributed (in atto-DNN)
        tokensDistributed = tokensDistributed.add(tokenCount);

        // Keep track of contributions (in Wei)
        ETHContributions[msg.sender] = ETHContributions[msg.sender].add(msg.value);

        // Keep track of how much tokens are issued to each contributor
        ETHContributorTokens[msg.sender] = ETHContributorTokens[msg.sender].add(tokenCount);

        // Increase total funds raised by contribution
        fundsRaisedInWei = fundsRaisedInWei.add(msg.value);

        // Increase tde total funds raised by contribution
        tdeFundsRaisedInWei = tdeFundsRaisedInWei.add(msg.value);

        // Determine which token allocation we should be deducting from
        DNNToken.DNNSupplyAllocations allocationType = DNNToken.DNNSupplyAllocations.TDESupplyAllocation;

        // Attempt to issue tokens to contributor
        if (!dnnToken.issueTokens(msg.sender, tokenCount, allocationType)) {
            revert();
        }

        // Transfer funds to multisig
        dnnHoldingMultisig.transfer(msg.value);

        return true;
    }

    ////////////////////////////////////////////////////////////////////////////////////////
    // @des Issues tokens for users who made purchase without using ETH during presale.   //
    // @param beneficiary Address the tokens will be issued to.                           //
    // @param weiamount ETH amount (in Wei)                                               //
    ////////////////////////////////////////////////////////////////////////////////////////
    function buyPRETDETokensWithoutETH(address beneficiary, uint256 weiamount, uint256 tokenCount)
        onlyCofounders
        IsNotAwaitingPRETDETokens(beneficiary)
        returns (bool)
    {

          // Keep track of how much tokens are issued to each contributor
          ETHContributorTokens[beneficiary] = ETHContributorTokens[beneficiary].add(tokenCount);

          // Keep track of contributions (in Wei)
          ETHContributions[beneficiary] = ETHContributions[beneficiary].add(weiamount);

          // Increase total funds raised by contribution
          fundsRaisedInWei = fundsRaisedInWei.add(weiamount);

          // Keep track of presale funds in addition, separately
          presaleFundsRaisedInWei = presaleFundsRaisedInWei.add(weiamount);

          // Add these tokens to the total amount of tokens this contributor is entitled to
          PRETDEContributorTokensPendingRelease[beneficiary] = PRETDEContributorTokensPendingRelease[beneficiary].add(tokenCount);

          // Incrment number of pre-tde contributors waiting for tokens
          PRETDEContributorsTokensPendingCount += 1;

          // Send tokens to contibutor
          return issuePRETDETokens(beneficiary);
      }

    ///////////////////////////////////////////////////////////////
    // @des Issues pending tokens to pre-tde contributor         //
    // @param beneficiary Address the tokens will be issued to.  //
    ///////////////////////////////////////////////////////////////
    function issuePRETDETokens(address beneficiary)
        onlyCofounders
        PRETDEContributorsAwaitingTokens
        HasPendingPRETDETokens(beneficiary)
        returns (bool)
    {

        // Amount of tokens to credit pre-tde contributor
        uint256 tokenCount = PRETDEContributorTokensPendingRelease[beneficiary];

        // Update total amount of tokens distributed (in atto-DNN)
        tokensDistributed = tokensDistributed.add(tokenCount);

        // Allocation type will be PRETDESupplyAllocation
        DNNToken.DNNSupplyAllocations allocationType = DNNToken.DNNSupplyAllocations.PRETDESupplyAllocation;

        // Attempt to issue tokens
        if (!dnnToken.issueTokens(beneficiary, tokenCount, allocationType)) {
            revert();
        }

        // Reduce number of pre-tde contributors waiting for tokens
        PRETDEContributorsTokensPendingCount -= 1;

        // Denote that tokens have been issued for this pre-tde contributor
        PRETDEContributorTokensPendingRelease[beneficiary] = 0;

        return true;
    }

    /////////////////////////////////////
    // @des Issue trickle down bonuses //
    /////////////////////////////////////
    function releaseTrickleDownBonuses()
      internal
    {

      // Determine which token allocation we should be deducting from
      DNNToken.DNNSupplyAllocations allocationType = DNNToken.DNNSupplyAllocations.TDESupplyAllocation;

      // Iteration Count
      uint256 iteration = 0;

      // Amount of additional tokens
      uint256 addedTokens = 0;

      if (bonusRangeOneAddressCount > 0) {
          for (iteration=0; iteration < bonusRangeOneAddressCount; iteration++) {
              addedTokens = ETHContributorTokens[bonusRangeOne[iteration]].mul(30).div(100);
              ETHContributorTokens[bonusRangeOne[iteration]] = ETHContributorTokens[bonusRangeOne[iteration]].add(addedTokens);
              if (!dnnToken.issueTokens(bonusRangeOne[iteration], addedTokens, allocationType)) {
                  revert();
              }
          }
      }

      if (bonusRangeTwoAddressCount > 0) {
          for (iteration=0; iteration < bonusRangeTwoAddressCount; iteration++) {
              addedTokens = ETHContributorTokens[bonusRangeTwo[iteration]].mul(15).div(100);
              ETHContributorTokens[bonusRangeTwo[iteration]] = ETHContributorTokens[bonusRangeTwo[iteration]].add(addedTokens);
              if (!dnnToken.issueTokens(bonusRangeTwo[iteration], addedTokens, allocationType)) {
                  revert();
              }
          }
      }

      if (bonusRangeThreeAddressCount > 0) {
          for (iteration=0; iteration < bonusRangeThreeAddressCount; iteration++) {
              addedTokens = ETHContributorTokens[bonusRangeThree[iteration]].mul(5).div(100);
              ETHContributorTokens[bonusRangeThree[iteration]] = ETHContributorTokens[bonusRangeThree[iteration]].add(addedTokens);
              if (!dnnToken.issueTokens(bonusRangeThree[iteration], addedTokens, allocationType)) {
                  revert();
              }
          }
      }

      if (bonusRangeFourAddressCount > 0) {
          for (iteration=0; iteration < bonusRangeFourAddressCount; iteration++) {
              addedTokens = ETHContributorTokens[bonusRangeFour[iteration]].mul(100).div(100);
              ETHContributorTokens[bonusRangeFour[iteration]] = ETHContributorTokens[bonusRangeFour[iteration]].add(addedTokens);
              if (!dnnToken.issueTokens(bonusRangeFour[iteration], addedTokens, allocationType)) {
                  revert();
              }
          }
      }

      trickleDownBonusesReleased = true;

    }

    /////////////////////////////////
    // @des Marks TDE as completed //
    /////////////////////////////////
    function finalizeTDE()
       onlyCofounders
       TDEHasEnded
    {
        // Check if the tokens are locked and all pre-sale tokens have been
        // transferred to the TDE Supply before unlocking tokens.
        require(dnnToken.tokensLocked() == true && dnnToken.PRETDESupplyRemaining() == 0);

        // Release Bonuses
        releaseTrickleDownBonuses();

        // Unlock tokens
        dnnToken.unlockTokens();

        // Update tokens distributed
        tokensDistributed += dnnToken.TDESupplyRemaining();

        // Transfer unsold TDE tokens to platform
        dnnToken.sendUnsoldTDETokensToPlatform();
    }


    ////////////////////////////////////////////////////////////////////////////////
    // @des Marks pre-TDE as completed by moving remaining tokens into TDE supply //
    ////////////////////////////////////////////////////////////////////////////////
    function finalizePRETDE()
       onlyCofounders
       NoPRETDEContributorsAwaitingTokens
    {
        // Check if we have tokens to transfer to TDE
        require(dnnToken.PRETDESupplyRemaining() > 0);

        // Transfer unsold TDE tokens to platform
        dnnToken.sendUnsoldPRETDETokensToTDE();
    }


    ///////////////////////////////
    // @des Contract constructor //
    ///////////////////////////////
    function DNNTDE(address tokenAddress, address founderA, address founderB, address dnnHolding, uint256 hardCap, uint256 startDate, uint256 endDate)
    {

        // Set token address
        dnnToken = DNNToken(tokenAddress);

        // Set cofounder addresses
        cofounderA = founderA;
        cofounderB = founderB;

        // Set DNN holding address
        dnnHoldingMultisig = dnnHolding;

        // Set hard cap
        maximumFundingGoalInETH = hardCap * 1 ether;

        // Range ETH
        rangeETHAmount = hardCap.div(bonusRangeCount) * 1 ether;

        // Set Start Date
        TDEStartDate = startDate >= now ? startDate : now;

        // Set End date (Make sure the end date is at least 30 days from start date)
        // Will default to a date that is exactly 30 days from start date.
        TDEEndDate = endDate > TDEStartDate && (endDate-TDEStartDate) >= 30 days ? endDate : (TDEStartDate + 30 days);
    }

    /////////////////////////////////////////////////////////
    // @des Handle's ETH sent directly to contract address //
    /////////////////////////////////////////////////////////
    function () payable {

        // Handle pre-sale contribution (tokens held, until tx confirmation from contributor)
        // Makes sure the user sends minimum PRE-TDE contribution, and that  pre-tde contributors
        // are unable to send subsequent ETH contributors before being issued tokens.
        if (now < TDEStartDate && msg.value >= minimumPRETDEContributionInWei && PRETDEContributorTokensPendingRelease[msg.sender] == 0) {

            // Keep track of contributions (in Wei)
            ETHContributions[msg.sender] = ETHContributions[msg.sender].add(msg.value);

            // Increase total funds raised by contribution
            fundsRaisedInWei = fundsRaisedInWei.add(msg.value);

            // Keep track of presale funds in addition, separately
            presaleFundsRaisedInWei = presaleFundsRaisedInWei.add(msg.value);

            /// Make a note of how many tokens this user should get for their contribution to the presale
            PRETDEContributorTokensPendingRelease[msg.sender] = PRETDEContributorTokensPendingRelease[msg.sender].add(calculateTokens(msg.value, now));

            // Keep track of pending tokens
            TokensPurchasedDuringPRETDE += calculateTokens(msg.value, now);

            // Increment number of pre-tde contributors waiting for tokens
            PRETDEContributorsTokensPendingCount += 1;

            // Prevent contributions that will cause us to have a shortage of tokens during the pre-sale
            if (TokensPurchasedDuringPRETDE > dnnToken.TDESupplyRemaining()+dnnToken.PRETDESupplyRemaining()) {
                revert();
            }

            // Transfer contribution directly to multisig
            dnnHoldingMultisig.transfer(msg.value);
        }

        // Handle public-sale contribution (tokens issued immediately)
        else if (now >= TDEStartDate && now < TDEEndDate) buyTokens();

        // Otherwise, reject the contribution
        else revert();
    }
}
