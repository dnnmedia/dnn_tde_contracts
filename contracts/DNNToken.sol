pragma solidity ^0.4.11;


import './libraries/math/SafeMath.sol';
import './libraries/token/ERC20Basic.sol';
import './libraries/token/StandardToken.sol';

/// @title Token contract - Implements Standard Token Interface with DNN features.
/// @author Dondrey Taylor - <dondrey@dnn.media>
contract DNNToken is StandardToken {

    using SafeMath for uint256;

    ////////////////////////////////////////////////////////////
    // Used to indicate which allocation we issue tokens from //
    ////////////////////////////////////////////////////////////
    enum DNNSupplyAllocations {
        EarlyBackerSupplyAllocation,
        PRETDESupplyAllocation,
        TDESupplyAllocation,
        BountySupplyAllocation,
        WriterAccountSupplyAllocation,
        AdvisorySupplyAllocation,
        PlatformSupplyAllocation
    }

    /////////////////////////////////////////////////////////////////////
    // Smart-Contract with permission to allocate tokens from supplies //
    /////////////////////////////////////////////////////////////////////
    address public allocatorAddress;
    address public crowdfundContract;

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
    uint256 public PRETDESupply; // 10%
    uint256 public TDESupply; // 40%
    uint256 public bountySupply; // 1%
    uint256 public writerAccountSupply; // 4%
    uint256 public advisorySupply; // 14%
    uint256 public cofoundersSupply; // 10%
    uint256 public platformSupply; // 11%

    uint256 public earlyBackerSupplyRemaining; // 10%
    uint256 public PRETDESupplyRemaining; // 10%
    uint256 public TDESupplyRemaining; // 40%
    uint256 public bountySupplyRemaining; // 1%
    uint256 public writerAccountSupplyRemaining; // 4%
    uint256 public advisorySupplyRemaining; // 14%
    uint256 public cofoundersSupplyRemaining; // 10%
    uint256 public platformSupplyRemaining; // 11%

    ////////////////////////////////////////////////////////////////////////////////////
    // Amount of CoFounder Supply that has been distributed based on vesting schedule //
    ////////////////////////////////////////////////////////////////////////////////////
    uint256 public cofoundersSupplyVestingTranches = 10;
    uint256 public cofoundersSupplyVestingTranchesIssued = 0;
    uint256 public cofoundersSupplyVestingStartDate; // Epoch
    uint256 public cofoundersSupplyDistributed = 0;  // # of atto-DNN distributed to founders

    //////////////////////////////////////////////
    // Prevents tokens from being transferrable //
    //////////////////////////////////////////////
    bool public tokensLocked = true;

    /////////////////////////////////////////////////////////////////////////////
    // Event triggered when tokens are transferred from one address to another //
    /////////////////////////////////////////////////////////////////////////////
    event Transfer(address indexed from, address indexed to, uint256 value);

    ////////////////////////////////////////////////////////////
    // Checks if tokens can be issued to founder at this time //
    ////////////////////////////////////////////////////////////
    modifier CofoundersTokensVested()
    {
        // Make sure that a starting vesting date has been set and 4 weeks have passed since vesting date
        require (cofoundersSupplyVestingStartDate != 0 && (now-cofoundersSupplyVestingStartDate) >= 4 weeks);

        // Get current tranche based on the amount of time that has passed since vesting start date
        uint256 currentTranche = now.sub(cofoundersSupplyVestingStartDate) / 4 weeks;

        // Amount of tranches that have been issued so far
        uint256 issuedTranches = cofoundersSupplyVestingTranchesIssued;

        // Amount of tranches that cofounders are entitled to
        uint256 maxTranches = cofoundersSupplyVestingTranches;

        // Make sure that we still have unvested tokens and that
        // the tokens for the current tranche have not been issued.
        require (issuedTranches != maxTranches && currentTranche > issuedTranches);

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

    /////////////////////////////////////////////////////////////////////
    // Checks to see if we are allowed to change the allocator address //
    /////////////////////////////////////////////////////////////////////
    modifier CanSetAllocator()
    {
       require (allocatorAddress == address(0x0) || tokensLocked == false);
       _;
    }

    //////////////////////////////////////////////////////////////////////
    // Checks to see if we are allowed to change the crowdfund contract //
    //////////////////////////////////////////////////////////////////////
    modifier CanSetCrowdfundContract()
    {
       require (crowdfundContract == address(0x0));
       _;
    }

    //////////////////////////////////////////////////
    // Checks if Allocator is performing the action //
    //////////////////////////////////////////////////
    modifier onlyAllocator()
    {
        require (msg.sender == allocatorAddress && tokensLocked == false);
        _;
    }

    ///////////////////////////////////////////////////////////
    // Checks if Crowdfund Contract is performing the action //
    ///////////////////////////////////////////////////////////
    modifier onlyCrowdfundContract()
    {
        require (msg.sender == crowdfundContract);
        _;
    }

    ///////////////////////////////////////////////////////////////////////////////////
    // Checks if Crowdfund Contract, Platform, or Allocator is performing the action //
    ///////////////////////////////////////////////////////////////////////////////////
    modifier onlyAllocatorOrCrowdfundContractOrPlatform()
    {
        require (msg.sender == allocatorAddress || msg.sender == crowdfundContract || msg.sender == platform);
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

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //  @des Function to change address that is allowed to do token issuance. Crowdfund contract can only be set once.   //
    //  @param newAddress Address of new issuance contract.                                                              //
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    function changeCrowdfundContract(address newAddress)
        onlyCofounders
        CanSetCrowdfundContract
    {
        crowdfundContract = newAddress;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //  @des Function to change address that is allowed to do token issuance. Allocator can only be set once.  //
    //  @param newAddress Address of new issuance contract.                                                    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    function changeAllocator(address newAddress)
        onlyCofounders
        CanSetAllocator
    {
        allocatorAddress = newAddress;
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
          Transfer(msg.sender, _to, _value);
          return BasicToken.transfer(_to, _value);
    }

    //////////////////////////////////////////////////////////
    // Transfers tokens from one address to another address //
    //////////////////////////////////////////////////////////
    function transferFrom(address _from, address _to, uint256 _value)
      TokensUnlocked
      returns (bool)
    {
          Transfer(_from, _to, _value);
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
        uint256 tokenCount = cofoundersSupply.div(cofoundersSupplyVestingTranches);

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

        // Update that a tranche has been issued
        cofoundersSupplyVestingTranchesIssued += 1;

        return true;
    }


    //////////////////
    // Issue tokens //
    //////////////////
    function issueTokens(address beneficiary, uint256 tokenCount, DNNSupplyAllocations allocationType)
      onlyAllocatorOrCrowdfundContractOrPlatform
      returns (bool)
    {
        // We'll use the following to determine whether the allocator, platform,
        // or the crowdfunding contract can allocate specified supply
        bool canAllocatorPerform = msg.sender == allocatorAddress && tokensLocked == false;
        bool canCrowdfundContractPerform = msg.sender == crowdfundContract;
        bool canPlatformPerform = msg.sender == platform && tokensLocked == false;

        // Early Backers
        if (canAllocatorPerform && allocationType == DNNSupplyAllocations.EarlyBackerSupplyAllocation && tokenCount <= earlyBackerSupplyRemaining) {
            earlyBackerSupplyRemaining = earlyBackerSupplyRemaining.sub(tokenCount);
        }

        // PRE-TDE
        else if (canCrowdfundContractPerform && msg.sender == crowdfundContract && allocationType == DNNSupplyAllocations.PRETDESupplyAllocation) {

              // Check to see if we have enough tokens to satisfy this purchase
              // using just the pre-tde.
              if (PRETDESupplyRemaining >= tokenCount) {

                    // Decrease pre-tde supply
                    PRETDESupplyRemaining = PRETDESupplyRemaining.sub(tokenCount);
              }

              // Check to see if we can satisfy this using pre-tde and tde supply combined
              else if (PRETDESupplyRemaining+TDESupplyRemaining >= tokenCount) {

                    // Decrease tde supply
                    TDESupplyRemaining = TDESupplyRemaining.sub(tokenCount-PRETDESupplyRemaining);

                    // Decrease pre-tde supply by its' remaining tokens
                    PRETDESupplyRemaining = 0;
              }

              // Otherwise, we can't satisfy this sale because we don't have enough tokens.
              else {
                  return false;
              }
        }

        // TDE
        else if (canCrowdfundContractPerform && allocationType == DNNSupplyAllocations.TDESupplyAllocation && tokenCount <= TDESupplyRemaining) {
            TDESupplyRemaining = TDESupplyRemaining.sub(tokenCount);
        }

        // Bounty
        else if (canAllocatorPerform && allocationType == DNNSupplyAllocations.BountySupplyAllocation && tokenCount <= bountySupplyRemaining) {
            bountySupplyRemaining = bountySupplyRemaining.sub(tokenCount);
        }

        // Writer Accounts
        else if (canAllocatorPerform && allocationType == DNNSupplyAllocations.WriterAccountSupplyAllocation && tokenCount <= writerAccountSupplyRemaining) {
            writerAccountSupplyRemaining = writerAccountSupplyRemaining.sub(tokenCount);
        }

        // Advisory
        else if (canAllocatorPerform && allocationType == DNNSupplyAllocations.AdvisorySupplyAllocation && tokenCount <= advisorySupplyRemaining) {
            advisorySupplyRemaining = advisorySupplyRemaining.sub(tokenCount);
        }

        // Platform (Also makes sure that the beneficiary is the platform address specified in this contract)
        else if (canPlatformPerform && allocationType == DNNSupplyAllocations.PlatformSupplyAllocation && tokenCount <= platformSupplyRemaining) {
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
    // Transfer Unsold tokens from TDE to Platform //
    /////////////////////////////////////////////////
    function sendUnsoldTDETokensToPlatform()
      external
      onlyCrowdfundContract
    {
        // Make sure we have tokens to send from TDE
        if (TDESupplyRemaining > 0) {

            // Add remaining tde tokens to platform remaining tokens
            platformSupplyRemaining = platformSupplyRemaining.add(TDESupplyRemaining);

            // Clear remaining tde token count
            TDESupplyRemaining = 0;
        }
    }

    /////////////////////////////////////////////////////
    // Transfer Unsold tokens from pre-TDE to Platform //
    /////////////////////////////////////////////////////
    function sendUnsoldPRETDETokensToTDE()
      external
      onlyCrowdfundContract
    {
          // Make sure we have tokens to send from pre-TDE
          if (PRETDESupplyRemaining > 0) {

              // Add remaining pre-tde tokens to tde remaining tokens
              TDESupplyRemaining = TDESupplyRemaining.add(PRETDESupplyRemaining);

              // Clear remaining pre-tde token count
              PRETDESupplyRemaining = 0;
        }
    }

    ////////////////////////////////////////////////////////////////
    // @des Allows tokens to be transferrable. Returns lock state //
    ////////////////////////////////////////////////////////////////
    function unlockTokens()
        external
        onlyCrowdfundContract
    {
        // Make sure tokens are currently locked before proceeding to unlock them
        require(tokensLocked == true);

        tokensLocked = false;
    }

    ///////////////////////////////////////////////////////////////////////
    //  @des Contract constructor function sets initial token balances.  //
    ///////////////////////////////////////////////////////////////////////
    function DNNToken(address founderA, address founderB, address platformAddress, uint256 vestingStartDate)
    {
          // Set cofounder addresses
          cofounderA = founderA;
          cofounderB = founderB;

          // Sets platform address
          platform = platformAddress;

          // Set total supply - 1 Billion DNN Tokens = (1,000,000,000 * 10^18) atto-DNN
          // 1 DNN = 10^18 atto-DNN
          totalSupply = uint256(1000000000).mul(uint256(10)**decimals);

          // Set Token Distributions (% of total supply)
          earlyBackerSupply = totalSupply.mul(10).div(100); // 10%
          PRETDESupply = totalSupply.mul(10).div(100); // 10%
          TDESupply = totalSupply.mul(40).div(100); // 40%
          bountySupply = totalSupply.mul(1).div(100); // 1%
          writerAccountSupply = totalSupply.mul(4).div(100); // 4%
          advisorySupply = totalSupply.mul(14).div(100); // 14%
          cofoundersSupply = totalSupply.mul(10).div(100); // 10%
          platformSupply = totalSupply.mul(11).div(100); // 11%

          // Set each remaining token count equal to its' respective supply
          earlyBackerSupplyRemaining = earlyBackerSupply;
          PRETDESupplyRemaining = PRETDESupply;
          TDESupplyRemaining = TDESupply;
          bountySupplyRemaining = bountySupply;
          writerAccountSupplyRemaining = writerAccountSupply;
          advisorySupplyRemaining = advisorySupply;
          cofoundersSupplyRemaining = cofoundersSupply;
          platformSupplyRemaining = platformSupply;

          // Sets cofounder vesting start date (Ensures that it is a date in the future, otherwise it will default to now)
          cofoundersSupplyVestingStartDate = vestingStartDate >= now ? vestingStartDate : now;
    }
}
