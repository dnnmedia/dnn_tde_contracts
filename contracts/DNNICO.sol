pragma solidity ^0.4.11;


import './libraries/math/SafeMath.sol';
import './DNNToken.sol';

/// @title DNNICO contract - Takes funds from users and issues tokens.
/// @author Dondrey Taylor - <dondrey@dnn.media>
contract DNNICO {

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
    // Start date of the ICO //
    ///////////////////////////
    uint256 public ICOStartDate;  // Epoch

    /////////////////////////
    // End date of the ICO //
    /////////////////////////
    uint256 public ICOEndDate;  // Epoch

    /////////////////////////////////
    // Amount of atto-DNN per wei //
    /////////////////////////////////
    uint256 public tokenExchangeRateBase = 3000; // 1 Wei = 3000 atto-DNN

    /////////////////////////////////////////////////
    // Number of tokens distributed (in atto-DNN) //
    /////////////////////////////////////////////////
    uint256 public tokensDistributed = 0;

    ///////////////////////////////////////////////
    // Minumum Contributions for pre-ICO and ICO //
    ///////////////////////////////////////////////
    uint256 public minimumICOContributionInWei = 0.001 ether;
    uint256 public minimumPREICOContributionInWei = 100 ether;

    //////////////////////
    // Funding Hard cap //
    //////////////////////
    uint256 public maximumFundingGoalInWei;

    //////////////////
    // Funds Raised //
    //////////////////
    uint256 public fundsRaisedInWei;

    ////////////////////////////////////////////
    // Keep track of Wei contributed per user //
    ////////////////////////////////////////////
    mapping(address => uint256) ETHContributions;


    ///////////////////////////////////////////////////////////////////////////////////////////
    // Keeps track of pre-ico contributors and whether or not their tokens have been issued  //
    ///////////////////////////////////////////////////////////////////////////////////////////
    mapping(address => bool) PREICOContributionTokensReleased;


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

    //////////////////////////////////////////////////////
    // Only DNN Holding Multisig is allowed to proceed. //
    //////////////////////////////////////////////////////
    modifier onlyDNNHoldingMultisig() {
        require (msg.sender == dnnHoldingMultisig);
        _;
    }

    //////////////////////////////////////
    // Check if the pre-ico is going on //
    //////////////////////////////////////
    modifier PREICOHasNotEnded() {
       require (now < ICOStartDate);
       _;
    }

    /////////////////////////////////////////////////////////////
    // User has to send at least the ether value of one token. //
    /////////////////////////////////////////////////////////////
    modifier ContributionIsAtLeastMinimum() {
        require (now >= ICOStartDate ?
                  msg.value >= minimumICOContributionInWei :
                  msg.value >= minimumPREICOContributionInWei
        );
        _;
    }

    ////////////////////////////////////
    // Check max cap has been reached //
    ////////////////////////////////////
    modifier MaximumGoalNotReached() {
       require (fundsRaisedInWei < maximumFundingGoalInWei);
       _;
    }

    ///////////////////////////////////////////////////////////////
    // Make sure max cap is not exceeded with added contribution //
    ///////////////////////////////////////////////////////////////
    modifier ContributionDoesNotCauseGoalExceedance() {
       uint256 newContractBalance = msg.value+fundsRaisedInWei;
       require (newContractBalance <= maximumFundingGoalInWei);
       _;
    }

    /////////////////////////////////////////////////////////////////
    // Check if the specified beneficiary has sent us funds before //
    /////////////////////////////////////////////////////////////////
    modifier HasNotReceivedPREICOTokens(address contributorAddress) {
        require (PREICOContributionTokensReleased[contributorAddress] != true);
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


    ////////////////////////////////
    // @des Returns current bonus //
    ////////////////////////////////
    function getCurrentICOBonus()
        constant
        returns (uint256)
    {
        return getICOTokenExchangeRate(now);
    }


    ////////////////////////////////
    // @des Returns current bonus //
    ////////////////////////////////
    function getCurrentPREICOBonus()
        constant
        returns (uint256)
    {
        return getPREICOTokenExchangeRate(now);
    }

    ///////////////////////////////////////////////////////////////////////
    // @des Returns bonus (in atto-DNN) per wei for the specific moment //
    // @param timestamp Time of purchase (in seconds)                    //
    ///////////////////////////////////////////////////////////////////////
    function getICOTokenExchangeRate(uint256 timestamp)
        constant
        returns (uint256)
    {
        // No bonus - ICO ended
        if (timestamp > ICOEndDate) {
            return uint256(0);
        }

        // No bonus - ICO has not started
        if (ICOStartDate > timestamp) {
            return uint256(0);
        }

        // Determine how long the ICO has been running
        uint256 icoDuration = timestamp.sub(ICOStartDate);

        // Beyond Week 1 - 0% bonus
        if (icoDuration > 1 weeks) {
            return tokenExchangeRateBase;

        // After 48 hours - 5% bonus
        } else if (icoDuration > 48 hours) {
            return tokenExchangeRateBase + tokenExchangeRateBase.mul(5).div(100);

        // First 48 hours - 10% bonus
        } else if (icoDuration <= 48 hours) {
            return tokenExchangeRateBase + tokenExchangeRateBase.mul(10).div(100);

        // Default - 0% bonus
        } else {
            return tokenExchangeRateBase;
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////
    // @des Returns bonus (in atto-DNN) per wei for the specific contribution amount //
    // @param weiamount The amount of wei being contributed                           //
    ////////////////////////////////////////////////////////////////////////////////////
    function getPREICOTokenExchangeRate(uint256 weiamount)
        constant
        returns (uint256)
    {
        // Presale will only accept contributions above minimum
        if (weiamount < minimumPREICOContributionInWei) {
            return uint256(0);
        }

        // 100 ETH - 199 ETH Bonus
        if (weiamount >= 100 ether && weiamount <= 199 ether) {
            return tokenExchangeRateBase + tokenExchangeRateBase.mul(15).div(100);

        // 200 ETH - 300 ETH Bonus
        } else if (weiamount >= 200 ether && weiamount <= 300 ether) {
            return tokenExchangeRateBase + tokenExchangeRateBase.mul(20).div(100);

        // 301 ETH - 2665 ETH Bonus
        } else if (weiamount >= 301 ether && weiamount <= 2665 ether) {
            return tokenExchangeRateBase + tokenExchangeRateBase.mul(25).div(100);

        // 2666+ ETH Bonus
        } else {
            return tokenExchangeRateBase + tokenExchangeRateBase.mul(40).div(100);
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
        uint256 computedTokensForPurchase = weiamount.mul(timestamp >= ICOStartDate ? getICOTokenExchangeRate(timestamp) : getPREICOTokenExchangeRate(weiamount));

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
        MaximumGoalNotReached
        ContributionIsAtLeastMinimum
        ContributionDoesNotCauseGoalExceedance
        returns (bool)
    {

        // Determine how many tokens should be issued
        uint256 tokenCount = calculateTokens(msg.value, now);

        // Update total amount of tokens distributed (in atto-DNN)
        tokensDistributed = tokensDistributed.add(tokenCount);

        // Keep track of contributions (in Wei)
        ETHContributions[msg.sender] = ETHContributions[msg.sender].add(msg.value);

        // Increase total funds raised by contribution
        fundsRaisedInWei = fundsRaisedInWei.add(msg.value);

        // Determine which token allocation we should be deducting from
        DNNToken.DNNSupplyAllocations allocationType = DNNToken.DNNSupplyAllocations.ICOSupplyAllocation;

        // Attempt to purchase tokens
        if (!dnnToken.issueTokens(msg.sender, tokenCount, allocationType)) {
            revert();
            return false;
        }

        return true;
    }

    ////////////////////////////////////////////////////////////////////////////////////////
    // @des Issues tokens for users who made purchase without using ETH during presale.   //
    // @param beneficiary Address the tokens will be issued to.                           //
    // @param weiamount ETH amount (in Wei)                                               //
    ////////////////////////////////////////////////////////////////////////////////////////
    function buyPREICOTokensWithoutETH(address beneficiary, uint256 weiamount, uint tokenCount)
        onlyCofounders
        PREICOHasNotEnded
        returns (bool)
    {

          // Update total amount of tokens distributed (in atto-DNN)
          tokensDistributed = tokensDistributed.add(tokenCount);

          // Keep track of contributions (in Wei)
          ETHContributions[beneficiary] = ETHContributions[beneficiary].add(weiamount);

          // Increase total funds raised by contribution
          fundsRaisedInWei = fundsRaisedInWei.add(weiamount);

          // Determine which token allocation we should be deducting from
          DNNToken.DNNSupplyAllocations allocationType = DNNToken.DNNSupplyAllocations.PREICOSupplyAllocation;

          // Attempt to purchase tokens
          if (!dnnToken.issueTokens(beneficiary, tokenCount, allocationType)) {
              revert();
              return false;
          }
          // Denote that the pre-ico contributor has been given their tokens
          else {
              PREICOContributionTokensReleased[beneficiary] = true;
          }

          return true;
      }

    ///////////////////////////////////////////////////////////////
    // @des Issues tokens to contributor based on custom bonuses //
    // @param beneficiary Address the tokens will be issued to.  //
    ///////////////////////////////////////////////////////////////
    function issuePREICOTokens(address beneficiary)
        onlyCofounders
        HasNotReceivedPREICOTokens(beneficiary)
        returns (bool)
    {

        // Amount of tokens to credit pre-ico contributor
        uint256 tokenCount = 0;

        // If no bonus was specified, then we will fall back on our pre-ico bonus ranges
        tokenCount = calculateTokens(ETHContributions[beneficiary], now);

        // Update total amount of tokens distributed (in atto-DNN)
        tokensDistributed = tokensDistributed.add(tokenCount);

        // Determine which token allocation we should be deducting from
        DNNToken.DNNSupplyAllocations allocationType = DNNToken.DNNSupplyAllocations.PREICOSupplyAllocation;

        // Attempt to purchase tokens
        if (!dnnToken.issueTokens(beneficiary, tokenCount, allocationType)) {
            revert();
            return false;
        }
        // Denote that the pre-ico contributor has been given their tokens
        else {
            PREICOContributionTokensReleased[beneficiary] = true;
        }

        return true;
    }

    ///////////////////////////////////////////////////////////
    // @des Sends all of the amount of funds to the multisig //
    ///////////////////////////////////////////////////////////
    function transferAllFunds()
      onlyCofounders
    {
        // Make sure we have funds to transfer
        require(this.balance != 0);

        // Attempt to transfer funds
        if (!dnnHoldingMultisig.transfer(this.balance)) {
            revert();
        }
    }


    /////////////////////////////////
    // @des Marks ICO as completed //
    /////////////////////////////////
    function finalizeICO()
       onlyCofounders
    {
        // Send all funds to multisig if we have funds
        if (this.balance > 0) {
            transferAllFunds();
        }

        // Unlock tokens
        dnnToken.unlockTokens();

        // Transfer unsold ICO tokens to platform
        dnnToken.sendUnsoldICOTokensToPlatform();
    }


    ////////////////////////////////////////////////////////////////////////////////
    // @des Marks pre-ICO as completed by moving remaining tokens into ICO supply //
    ////////////////////////////////////////////////////////////////////////////////
    function finalizePREICO()
       onlyCofounders
    {
        // Transfer unsold ICO tokens to platform
        dnnToken.sendUnsoldPREICOTokensToICO();
    }


    ///////////////////////////////
    // @des Contract constructor //
    ///////////////////////////////
    function DNNICO(address tokenAddress, address founderA, address founderB, address dnnHolding, uint256 hardCapInWei, uint256 startDate, uint256 endDate)
    {

        // Set token address
        dnnToken = DNNToken(tokenAddress);

        // Set cofounder addresses
        cofounderA = founderA;
        cofounderB = founderB;

        // Set DNN holding address
        dnnHoldingMultisig = dnnHolding;

        // Set Hard Cap
        maximumFundingGoalInWei = hardCapInWei;

        // Set Start Date
        ICOStartDate = startDate;

        // Set End date
        ICOEndDate = endDate;
    }

    ////////////////////////////////////////////////////
    // Handle's ETH sent directly to contract address //
    ////////////////////////////////////////////////////
    function () payable {

        // Handle pre-sale contribution (tokens held, until tx confirmation from contributor)
        if (now < ICOStartDate) {

            // Keep track of contributions (in Wei)
            ETHContributions[msg.sender] = ETHContributions[msg.sender].add(msg.value);

            // Increase total funds raised by contribution
            fundsRaisedInWei = fundsRaisedInWei.add(msg.value);

        }

        // Handle public-sale contribution (tokens issued immediately)
        else if (now >= ICOStartDate && now < ICOEndDate) buyTokens();

        // Otherwise, reject the contribution
        else revert();
    }
}
