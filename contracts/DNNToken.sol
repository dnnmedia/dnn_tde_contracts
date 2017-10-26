pragma solidity ^0.4.11;


import './libraries/math/SafeMath.sol';
import './libraries/token/ERC20Basic.sol';
import './libraries/token/StandardToken.sol';

/// @title Token contract - Implements Standard Token Interface with DNN features.
/// @author Dondrey Taylor - <dondrey@dnn.media>
contract DNNToken is StandardToken {

    using SafeMath for uint256;

    /////////////////////////////////////////////////////////////
    // Used to indicate which allocation we issues tokens from //
    /////////////////////////////////////////////////////////////
    enum DNNSupplyAllocations {
        EarlyBackerSupplyAllocation,
        PREICOSupplyAllocation,
        ICOSupplyAllocation,
        BountySupplyAllocation,
        WriterAccountSupplyAllocation,
        AdvisorySupplyAllocation,
        CofoundersSupplyAllocation,
        PlatformSupplyAllocation
    }

    /////////////////////////////////////////////////////////////////////
    // Smart-Contract with permission to allocate tokens from supplies //
    /////////////////////////////////////////////////////////////////////
    address public allocator;

    /////////////////////
    // Token Meta Data //
    /////////////////////
    string constant public name = "DNN";
    string constant public symbol = "DNN";
    uint8 constant public decimals = 18; // 1 DNN = 1 * 10^18 atto-DNN

    /////////////////////////////////////////
    // Addresses of the co-founders of DNN //
    /////////////////////////////////////////
    address public cofounderA;
    address public cofounderB;

    /////////////////////////
    // Address of Platform //
    /////////////////////////
    address public platform;

    /////////////////////////////////////////////
    // Token Distributions (% of total supply) //
    /////////////////////////////////////////////
    uint256 public earlyBackerSupply; // 10%
    uint256 public PREICOSupply; // 10%
    uint256 public ICOSupply; // 40%
    uint256 public bountySupply; // 1%
    uint256 public writerAccountSupply; // 4%
    uint256 public advisorySupply; // 12%
    uint256 public cofoundersSupply; // 10%
    uint256 public platformSupply; // 13%

    uint256 public earlyBackerSupplyRemaining; // 10%
    uint256 public PREICOSupplyRemaining; // 10%
    uint256 public ICOSupplyRemaining; // 40%
    uint256 public bountySupplyRemaining; // 1%
    uint256 public writerAccountSupplyRemaining; // 4%
    uint256 public advisorySupplyRemaining; // 12%
    uint256 public cofoundersSupplyRemaining; // 10%
    uint256 public platformSupplyRemaining; // 13%

    ////////////////////////////////////////////////////////////////////////////////////
    // Amount of CoFounder Supply that has been distributed based on vesting schedule //
    ////////////////////////////////////////////////////////////////////////////////////
    uint256 public cofoundersSupplyVestingIntervals = 10;
    uint256 public cofoundersSupplyVestingStartDate; // Epoch
    uint256 public cofoundersSupplyDistributed = 0;  // # of atto-DNN distributed to founders

    //////////////////////////////////////////////
    // Prevents tokens from being transferrable //
    //////////////////////////////////////////////
    bool public tokensLocked = true;

    ////////////////////////////////////////////////////////////
    // Checks if tokens can be issued to founder at this time //
    ////////////////////////////////////////////////////////////
    modifier CofoundersTokensVested()
    {
        // Make sure that a starting vesting date has been set
        require (cofoundersSupplyVestingStartDate != 0);

        // Amount of time that has passed since the cofounder vesting start date
        uint256 timePassed = now.sub(cofoundersSupplyVestingStartDate);

        // Amount of scheduled intervals remaining for cofounder token issuance
        uint256 scheduledIntervalsLeft = cofoundersSupplyRemaining.div(cofoundersSupply.div(cofoundersSupplyVestingIntervals));

        // Make sure that we still have unvested tokens and that
        // the tokens for the current interval have not been issued.
        require (
                  (scheduledIntervalsLeft > 0)  &&

                  ((timePassed >= 10*30 days && scheduledIntervalsLeft == 1) ||
                  (timePassed >= 9*30 days && scheduledIntervalsLeft == 2)  ||
                  (timePassed >= 8*30 days && scheduledIntervalsLeft == 3)  ||
                  (timePassed >= 7*30 days && scheduledIntervalsLeft == 4)   ||
                  (timePassed >= 6*30 days && scheduledIntervalsLeft == 5)   ||
                  (timePassed >= 5*30 days && scheduledIntervalsLeft == 6)   ||
                  (timePassed >= 4*30 days && scheduledIntervalsLeft == 7)   ||
                  (timePassed >= 3*30 days && scheduledIntervalsLeft == 8)   ||
                  (timePassed >= 2*30 days && scheduledIntervalsLeft == 9)   ||
                  (timePassed >= 1*30 days && scheduledIntervalsLeft == 10))
              );
          _;
    }

    ///////////////////////////////////
    // Checks if tokens are unlocked //
    ///////////////////////////////////
    modifier TokensUnlocked()
    {
        require (tokensLocked == false);
        _;
    }

    /////////////////////////////////
    // Checks if tokens are locked //
    /////////////////////////////////
    modifier TokensLocked()
    {
       require (tokensLocked == true);
       _;
    }

    ////////////////////////////////////////////////////
    // Checks if CoFounders are performing the action //
    ////////////////////////////////////////////////////
    modifier onlyCofounders()
    {
        require (msg.sender == cofounderA || msg.sender == cofounderB);
        _;
    }

    ////////////////////////////////////////////////////
    // Checks if CoFounder A is performing the action //
    ////////////////////////////////////////////////////
    modifier onlyCofounderA()
    {
        require (msg.sender == cofounderA);
        _;
    }

    ////////////////////////////////////////////////////
    // Checks if CoFounder B is performing the action //
    ////////////////////////////////////////////////////
    modifier onlyCofounderB()
    {
        require (msg.sender == cofounderB);
        _;
    }

    //////////////////////////////////////////////////
    // Checks if Allocator is performing the action //
    //////////////////////////////////////////////////
    modifier onlyAllocator()
    {
        require (msg.sender == allocator);
        _;
    }

    /////////////////////////////////////////////////
    // Checks if platform is performing the action //
    /////////////////////////////////////////////////
    modifier onlyPlatform()
    {
        require (msg.sender == platform);
        _;
    }

    ///////////////////////////////////////////////////////////////////////
    //  @des Function to change address that is manage platform holding  //
    //  @param newAddress Address of new issuance contract.              //
    ///////////////////////////////////////////////////////////////////////
    function changePlatform(address newAddress)
        onlyCofounders
    {
        platform = newAddress;
    }

    /////////////////////////////////////////////////////////////////////////////
    //  @des Function to change address that is allowed to do token issuance.  //
    //  @param newAddress Address of new issuance contract.                    //
    /////////////////////////////////////////////////////////////////////////////
    function changeAllocator(address newAddress)
        onlyCofounders
    {
        allocator = newAddress;
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


    //////////////////////////////////////////////////////////////
    // Transfers tokens from senders address to another address //
    //////////////////////////////////////////////////////////////
    function transfer(address _to, uint256 _value)
      TokensUnlocked
      returns (bool)
    {
          return BasicToken.transfer(_to, _value);
    }

    //////////////////////////////////////////////////////////
    // Transfers tokens from one address to another address //
    //////////////////////////////////////////////////////////
    function transferFrom(address _from, address _to, uint256 _value)
      TokensUnlocked
      returns (bool)
    {
          return StandardToken.transferFrom(_from, _to, _value);
    }


    ///////////////////////////////////////////////////////////////////////////////////////////////
    //  @des Cofounders issue tokens to themsleves if within vesting period. Returns success.    //
    //  @param beneficiary Address of receiver.                                                  //
    //  @param tokenCount Number of tokens to issue.                                             //
    ///////////////////////////////////////////////////////////////////////////////////////////////
    function issueCofoundersTokensIfPossible()
        onlyCofounders
        CofoundersTokensVested
        returns (bool)
    {
        // Compute total amount of vested tokens to issue
        uint256 tokenCount = cofoundersSupply.div(cofoundersSupplyVestingIntervals);

        // Make sure that there are cofounder tokens left
        if (tokenCount > cofoundersSupplyRemaining) {
           return false;
        }

        // Decrease cofounders supply
        cofoundersSupplyRemaining = cofoundersSupplyRemaining.sub(tokenCount);

        // Update how many tokens have been distributed to cofounders
        cofoundersSupplyDistributed = cofoundersSupplyDistributed.add(tokenCount);

        // Split tokens between both founders
        balances[cofounderA] = balances[cofounderA].add(tokenCount.div(2));
        balances[cofounderB] = balances[cofounderB].add(tokenCount.div(2));
        return true;
    }


    //////////////////
    // Issue tokens //
    //////////////////
    function issueTokens(address beneficiary, uint tokenCount, DNNSupplyAllocations allocationType)
      onlyAllocator
      returns (bool)
    {
        // Early Backers
        if (allocationType == DNNSupplyAllocations.EarlyBackerSupplyAllocation && tokenCount <= earlyBackerSupplyRemaining) {
            earlyBackerSupplyRemaining = earlyBackerSupplyRemaining.sub(tokenCount);
        }

        // PRE-ICO
        else if (allocationType == DNNSupplyAllocations.PREICOSupplyAllocation) {

              // Check to see if we have enough tokens to satisfy this purchase
              // using just the pre-ico.
              if (PREICOSupplyRemaining >= tokenCount) {

                    // Decrease pre-ico supply
                    PREICOSupplyRemaining = PREICOSupplyRemaining.sub(tokenCount);
              }

              // Check to see if we can satisfy this using pre-ico and ico supply combined
              else if (PREICOSupplyRemaining+ICOSupplyRemaining >= tokenCount) {

                    // Decrease ico supply
                    ICOSupplyRemaining = ICOSupplyRemaining.sub(tokenCount-PREICOSupplyRemaining);

                    // Decrease pre-ico supply by its' remaining tokens
                    PREICOSupplyRemaining = 0;
              }

              // Otherwise, we can't satisfy this sale because we don't have enough tokens.
              else {
                  return false;
              }
        }

        // ICO
        else if (allocationType == DNNSupplyAllocations.ICOSupplyAllocation && tokenCount <= ICOSupplyRemaining) {
            ICOSupplyRemaining = ICOSupplyRemaining.sub(tokenCount);
        }

        // Bounty
        else if (allocationType == DNNSupplyAllocations.BountySupplyAllocation && tokenCount <= bountySupplyRemaining) {
            bountySupplyRemaining = bountySupplyRemaining.sub(tokenCount);
        }

        // Writer Accounts
        else if (allocationType == DNNSupplyAllocations.WriterAccountSupplyAllocation && tokenCount <= writerAccountSupplyRemaining) {
            writerAccountSupplyRemaining = writerAccountSupplyRemaining.sub(tokenCount);
        }

        // Advisory
        else if (allocationType == DNNSupplyAllocations.AdvisorySupplyAllocation && tokenCount <= advisorySupplyRemaining) {
            advisorySupplyRemaining = advisorySupplyRemaining.sub(tokenCount);
        }

        // Platform
        else if (allocationType == DNNSupplyAllocations.PlatformSupplyAllocation && tokenCount <= platformSupplyRemaining) {
            platformSupplyRemaining = platformSupplyRemaining.sub(tokenCount);
        }

        else {
            return false;
        }

        // Credit tokens to the address specified
        balances[beneficiary] = balances[beneficiary].add(tokenCount);

        return true;
    }

    /////////////////////////////////////////////////
    // Transfer Unsold tokens from ICO to Platform //
    /////////////////////////////////////////////////
    function sendUnsoldICOTokensToPlatform()
      external
      onlyAllocator
    {
        // Add remaining ico tokens to platform remaining tokens
        platformSupplyRemaining = platformSupplyRemaining.add(ICOSupplyRemaining);

        // Clear remaining ico token count
        ICOSupplyRemaining = 0;
    }

    /////////////////////////////////////////////////
    // Transfer Unsold tokens from ICO to Platform //
    /////////////////////////////////////////////////
    function sendUnsoldPREICOTokensToICO()
      external
      onlyAllocator
    {
        // Add remaining pre-ico tokens to ico remaining tokens
        ICOSupplyRemaining = ICOSupplyRemaining.add(PREICOSupplyRemaining);

        // Clear remaining pre-ico token count
        PREICOSupplyRemaining = 0;
    }

    ////////////////////////////////////////////////////////////////
    // @des Allows tokens to be transferrable. Returns lock state //
    ////////////////////////////////////////////////////////////////
    function unlockTokens()
        external
        onlyAllocator
    {
        tokensLocked = false;
    }

    ///////////////////////////////////////////////////////////////////////
    //  @des Contract constructor function sets initial token balances.  //
    ///////////////////////////////////////////////////////////////////////
    function DNNToken(address founderA, address founderB, uint256 vestingStartDate)
    {
          // Set cofounder addresses
          cofounderA = founderA;
          cofounderB = founderB;

          // Set total supply - 1 Billion DNN Tokens = (1,000,000,000 * 10^18) atto-DNN
          // 1 DNN = 10^18 atto-DNN
          totalSupply = uint256(1000000000).mul(uint256(10)**decimals);

          // Set Token Distributions (% of total supply)
          earlyBackerSupply = totalSupply.mul(10).div(100); // 10%
          PREICOSupply = totalSupply.mul(10).div(100); // 10%
          ICOSupply = totalSupply.mul(40).div(100); // 40%
          bountySupply = totalSupply.mul(1).div(100); // 1%
          writerAccountSupply = totalSupply.mul(4).div(100); // 4%
          advisorySupply = totalSupply.mul(12).div(100); // 12%
          cofoundersSupply = totalSupply.mul(10).div(100); // 10%
          platformSupply = totalSupply.mul(13).div(100); // 13%

          // Set each remaining token count equal to its' respective supply
          earlyBackerSupplyRemaining = earlyBackerSupply;
          PREICOSupplyRemaining = PREICOSupply;
          ICOSupplyRemaining = ICOSupply;
          bountySupplyRemaining = bountySupply;
          writerAccountSupplyRemaining = writerAccountSupply;
          advisorySupplyRemaining = advisorySupply;
          cofoundersSupplyRemaining = cofoundersSupply;
          platformSupplyRemaining = platformSupply;

          // Sets cofounder vesting start date
          cofoundersSupplyVestingStartDate = vestingStartDate;
    }
}
