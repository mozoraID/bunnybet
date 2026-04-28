// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title  PredictionMarket
 * @author BunnyBet Protocol
 * @notice Binary Yes/No market denominated in USDM.
 *
 * Fee model
 * ─────────
 * • platformFeeBps  (e.g. 200 = 2 %) → sent directly to feeRecipient on every trade
 * • CREATOR_FEE_BPS (fixed 100 = 1 %) → accrues in contract, creator withdraws
 * • Net = amount − platformFee − creatorFee → added to YES/NO pool
 *
 * Minimum bet: 1 USDM (1e18 raw)
 */
contract PredictionMarket is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant FEE_DENOMINATOR  = 10_000;
    uint256 public constant CREATOR_FEE_BPS  = 100;      // fixed 1 %
    uint256 public constant MIN_BET          = 1e18;     // 1 USDM

    // ─── Immutables ───────────────────────────────────────────────────────────
    IERC20  public immutable usdm;
    address public immutable factory;
    address public immutable creator;

    // Set at construction from factory snapshot; predictable for traders
    address public immutable feeRecipient;
    uint256 public immutable platformFeeBps;  // e.g. 200

    // ─── Metadata ─────────────────────────────────────────────────────────────
    string  public question;
    string  public description;
    string  public imageUrl;
    string  public category;
    uint256 public endTime;
    uint256 public createdAt;

    // ─── Pool state ───────────────────────────────────────────────────────────
    uint256 public yesPool;
    uint256 public noPool;
    uint256 public creatorFeesAccrued;   // platform fees are sent immediately

    mapping(address => uint256) public yesShares;
    mapping(address => uint256) public noShares;
    mapping(address => bool)    public hasRedeemed;
    mapping(address => bool)    public hasClaimedRefund;

    bool public resolved;
    bool public outcome;
    bool public cancelled;

    // ─── Events ───────────────────────────────────────────────────────────────
    event SharesBought(
        address indexed buyer,
        bool    indexed isYes,
        uint256         usdmIn,
        uint256         shares,
        uint256         platformFeeAmt,
        uint256         creatorFeeAmt,
        uint256         newYesPool,
        uint256         newNoPool
    );
    event MarketResolved(bool outcome, uint256 yesPool, uint256 noPool);
    event MarketCancelled();
    event Redeemed(address indexed user, uint256 payout);
    event RefundClaimed(address indexed user, uint256 amount);
    event CreatorFeesWithdrawn(address indexed creator, uint256 amount);
    event MarketPaused();
    event MarketUnpaused();

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyFactoryOwner() {
        require(msg.sender == _factoryOwner(), "PM: not factory owner");
        _;
    }

    modifier marketOpen() {
        require(!resolved,               "PM: resolved");
        require(!cancelled,              "PM: cancelled");
        require(block.timestamp < endTime, "PM: expired");
        _;
    }

    modifier notFinalized() {
        require(!resolved,  "PM: resolved");
        require(!cancelled, "PM: cancelled");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(
        address _usdm,
        address _creator,
        address _feeRecipient,
        uint256 _platformFeeBps,
        string memory _question,
        string memory _description,
        string memory _imageUrl,
        string memory _category,
        uint256 _endTime
    ) {
        require(_usdm          != address(0), "PM: zero usdm");
        require(_feeRecipient  != address(0), "PM: zero feeRecipient");
        require(_endTime > block.timestamp,   "PM: end in past");
        require(bytes(_question).length > 0,  "PM: empty question");
        require(_platformFeeBps + CREATOR_FEE_BPS < FEE_DENOMINATOR, "PM: fees too high");

        usdm           = IERC20(_usdm);
        factory        = msg.sender;
        creator        = _creator;
        feeRecipient   = _feeRecipient;
        platformFeeBps = _platformFeeBps;
        question       = _question;
        description    = _description;
        imageUrl       = _imageUrl;
        category       = _category;
        endTime        = _endTime;
        createdAt      = block.timestamp;
    }

    // ─── Buy YES ──────────────────────────────────────────────────────────────
    /**
     * @notice Buy YES shares. Caller must have approved USDM first.
     * @param  amount  Gross USDM to spend.
     */
    function buyYes(uint256 amount)
        external
        nonReentrant
        whenNotPaused
        marketOpen
    {
        require(amount >= MIN_BET, "PM: below min bet");

        (uint256 net, uint256 pFee, uint256 cFee) = _splitFees(amount);

        usdm.safeTransferFrom(msg.sender, address(this), amount);

        // Platform fee → feeRecipient immediately (no custody)
        if (pFee > 0) usdm.safeTransfer(feeRecipient, pFee);

        creatorFeesAccrued    += cFee;
        yesShares[msg.sender] += net;
        yesPool               += net;

        emit SharesBought(msg.sender, true, amount, net, pFee, cFee, yesPool, noPool);
    }

    // ─── Buy NO ───────────────────────────────────────────────────────────────
    /**
     * @notice Buy NO shares. Caller must have approved USDM first.
     * @param  amount  Gross USDM to spend.
     */
    function buyNo(uint256 amount)
        external
        nonReentrant
        whenNotPaused
        marketOpen
    {
        require(amount >= MIN_BET, "PM: below min bet");

        (uint256 net, uint256 pFee, uint256 cFee) = _splitFees(amount);

        usdm.safeTransferFrom(msg.sender, address(this), amount);

        if (pFee > 0) usdm.safeTransfer(feeRecipient, pFee);

        creatorFeesAccrued   += cFee;
        noShares[msg.sender] += net;
        noPool               += net;

        emit SharesBought(msg.sender, false, amount, net, pFee, cFee, yesPool, noPool);
    }

    // ─── Resolve ──────────────────────────────────────────────────────────────
    /**
     * @notice Resolve the market.
     *         Creator can call after endTime.
     *         Factory owner (admin) can call anytime.
     */
    function resolve(bool _outcome) external notFinalized {
        bool isCreator = msg.sender == creator;
        bool isAdmin   = msg.sender == _factoryOwner();

        require(isCreator || isAdmin, "PM: not authorized");
        if (isCreator && !isAdmin) {
            require(block.timestamp >= endTime, "PM: not ended");
        }

        resolved = true;
        outcome  = _outcome;
        emit MarketResolved(_outcome, yesPool, noPool);
    }

    // ─── Cancel ───────────────────────────────────────────────────────────────
    function cancel() external onlyFactoryOwner notFinalized {
        cancelled = true;
        emit MarketCancelled();
    }

    // ─── Pause / Unpause (factory owner only) ─────────────────────────────────
    function pauseMarket() external onlyFactoryOwner {
        _pause();
        emit MarketPaused();
    }

    function unpauseMarket() external onlyFactoryOwner {
        _unpause();
        emit MarketUnpaused();
    }

    // ─── Redeem winnings ──────────────────────────────────────────────────────
    function redeem() external nonReentrant {
        require(resolved,                 "PM: not resolved");
        require(!hasRedeemed[msg.sender], "PM: already redeemed");

        uint256 userShares;
        uint256 winningPool;
        if (outcome) { userShares = yesShares[msg.sender]; winningPool = yesPool; }
        else         { userShares = noShares[msg.sender];  winningPool = noPool;  }

        require(userShares > 0, "PM: no winning shares");

        hasRedeemed[msg.sender] = true;
        if (outcome) { yesShares[msg.sender] = 0; }
        else         { noShares[msg.sender]  = 0; }

        uint256 payout = (userShares * (yesPool + noPool)) / winningPool;
        usdm.safeTransfer(msg.sender, payout);
        emit Redeemed(msg.sender, payout);
    }

    // ─── Claim refund (cancelled market) ──────────────────────────────────────
    function claimRefund() external nonReentrant {
        require(cancelled,                      "PM: not cancelled");
        require(!hasClaimedRefund[msg.sender],  "PM: already claimed");

        uint256 refund = yesShares[msg.sender] + noShares[msg.sender];
        require(refund > 0, "PM: nothing to refund");

        hasClaimedRefund[msg.sender] = true;
        yesShares[msg.sender] = 0;
        noShares[msg.sender]  = 0;

        usdm.safeTransfer(msg.sender, refund);
        emit RefundClaimed(msg.sender, refund);
    }

    // ─── Creator fee withdrawal ────────────────────────────────────────────────
    function withdrawCreatorFees() external nonReentrant {
        require(msg.sender == creator, "PM: not creator");
        uint256 amt = creatorFeesAccrued;
        require(amt > 0, "PM: no fees");
        creatorFeesAccrued = 0;
        usdm.safeTransfer(creator, amt);
        emit CreatorFeesWithdrawn(creator, amt);
    }

    // ─── View: market snapshot ─────────────────────────────────────────────────
    function getMarketInfo() external view returns (
        uint256 _yesPool,
        uint256 _noPool,
        uint256 _totalPool,
        uint256 _yesProb,       // bps 0–10 000
        uint256 _noProb,
        uint256 _volume,        // gross approx
        bool    _resolved,
        bool    _outcome,
        bool    _cancelled,
        uint256 _timeLeft,
        bool    _paused
    ) {
        uint256 total   = yesPool + noPool;
        uint256 yesProb = total > 0 ? (yesPool * 10_000) / total : 5_000;

        uint256 totalFeeBps = platformFeeBps + CREATOR_FEE_BPS;
        uint256 volume = total > 0
            ? (total * FEE_DENOMINATOR) / (FEE_DENOMINATOR - totalFeeBps) + creatorFeesAccrued
            : 0;

        return (
            yesPool, noPool, total, yesProb, 10_000 - yesProb, volume,
            resolved, outcome, cancelled,
            block.timestamp < endTime ? endTime - block.timestamp : 0,
            paused()
        );
    }

    function getUserPosition(address _user) external view returns (
        uint256 _yesShares,
        uint256 _noShares,
        uint256 _estimatedYesPayout,
        uint256 _estimatedNoPayout,
        bool    _hasRedeemed,
        bool    _hasClaimedRefund
    ) {
        uint256 total  = yesPool + noPool;
        uint256 estYes = (yesPool > 0 && total > 0) ? (yesShares[_user] * total) / yesPool : 0;
        uint256 estNo  = (noPool  > 0 && total > 0) ? (noShares[_user]  * total) / noPool  : 0;
        return (yesShares[_user], noShares[_user], estYes, estNo,
                hasRedeemed[_user], hasClaimedRefund[_user]);
    }

    // ─── Internals ────────────────────────────────────────────────────────────
    function _splitFees(uint256 amount)
        internal view
        returns (uint256 net, uint256 pFee, uint256 cFee)
    {
        pFee = (amount * platformFeeBps)  / FEE_DENOMINATOR;
        cFee = (amount * CREATOR_FEE_BPS) / FEE_DENOMINATOR;
        net  = amount - pFee - cFee;
    }

    function _factoryOwner() internal view returns (address) {
        (bool ok, bytes memory data) = factory.staticcall(abi.encodeWithSignature("owner()"));
        require(ok, "PM: factory owner call failed");
        return abi.decode(data, (address));
    }
}
