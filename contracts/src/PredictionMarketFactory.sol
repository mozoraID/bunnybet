// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable}          from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable}         from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard}  from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20}           from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}        from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {PredictionMarket} from "./PredictionMarket.sol";

/**
 * @title  PredictionMarketFactory
 * @author BunnyBet Protocol
 * @notice Deploys and administers all BunnyBet prediction markets.
 *
 * Admin functions (onlyOwner):
 *   resolveMarket(id, outcome)  — force-resolve any market by index
 *   cancelMarket(id)            — cancel any market
 *   pauseMarket(id)             — pause trading on a market
 *   unpauseMarket(id)           — resume trading on a market
 *   setPlatformFee(newBps)      — update fee for future markets (max 1 000 = 10 %)
 *   updateFeeRecipient(addr)    — change where platform fees go
 *   withdrawFees()              — sweep any USDM accidentally sent to factory
 *   pause() / unpause()         — pause/unpause market creation
 */
contract PredictionMarketFactory is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────────────────────
    IERC20  public immutable usdm;
    address public feeRecipient;
    uint256 public platformFeeBps;           // default 200 = 2 %

    uint256 public constant MAX_FEE_BPS = 1_000; // 10 % hard cap

    // Index-based market registry (marketId → address)
    mapping(uint256 => address) private _marketById;
    uint256 public marketCount;

    // Fast lookups
    mapping(address => bool)      public isMarket;
    mapping(address => uint256[]) private _marketIdsByCreator;
    mapping(address => uint256)   public marketIdByAddress;

    // ─── Events ───────────────────────────────────────────────────────────────
    event MarketCreated(
        uint256 indexed marketId,
        address indexed market,
        address indexed creator,
        string          question,
        string          category,
        uint256         endTime
    );
    event MarketResolved(uint256 indexed marketId, address indexed market, bool outcome);
    event MarketCancelled(uint256 indexed marketId, address indexed market);
    event PlatformFeeUpdated(uint256 oldBps, uint256 newBps);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event FeesSwept(address indexed recipient, uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────────────────
    /**
     * @param _usdm           USDM token address on MegaETH.
     * @param _feeRecipient   Wallet that receives platform fees.
     * @param _platformFeeBps Initial fee in basis points (200 = 2 %).
     */
    constructor(
        address _usdm,
        address _feeRecipient,
        uint256 _platformFeeBps
    ) Ownable(msg.sender) {
        require(_usdm         != address(0), "Factory: zero usdm");
        require(_feeRecipient != address(0), "Factory: zero feeRecipient");
        require(_platformFeeBps <= MAX_FEE_BPS, "Factory: fee too high");

        usdm           = IERC20(_usdm);
        feeRecipient   = _feeRecipient;
        platformFeeBps = _platformFeeBps;

        emit FeeRecipientUpdated(address(0), _feeRecipient);
        emit PlatformFeeUpdated(0, _platformFeeBps);
    }

    // ─── Create market ────────────────────────────────────────────────────────
    /**
     * @notice Deploy a new binary prediction market.
     *         Pauses if factory is paused (Pausable).
     */
    function createMarket(
        string calldata _question,
        string calldata _description,
        string calldata _imageUrl,
        string calldata _category,
        uint256         _endTime
    ) external whenNotPaused returns (address market) {
        require(_endTime > block.timestamp,        "Factory: end in past");
        require(bytes(_question).length > 0,       "Factory: empty question");
        require(bytes(_question).length <= 200,    "Factory: question too long");
        require(bytes(_description).length <= 2000,"Factory: description too long");

        uint256 id = marketCount;

        PredictionMarket pm = new PredictionMarket(
            address(usdm),
            msg.sender,       // creator
            feeRecipient,     // snapshot of current feeRecipient
            platformFeeBps,   // snapshot of current fee
            _question,
            _description,
            _imageUrl,
            _category,
            _endTime
        );

        market = address(pm);
        _marketById[id]                  = market;
        isMarket[market]                 = true;
        marketIdByAddress[market]        = id;
        _marketIdsByCreator[msg.sender].push(id);
        marketCount++;

        emit MarketCreated(id, market, msg.sender, _question, _category, _endTime);
    }

    // ─── Admin: resolve ───────────────────────────────────────────────────────
    /**
     * @notice Force-resolve any market by its numeric ID.
     */
    function resolveMarket(uint256 marketId, bool _outcome) external onlyOwner {
        address m = _requireMarket(marketId);
        PredictionMarket(m).resolve(_outcome);
        emit MarketResolved(marketId, m, _outcome);
    }

    // ─── Admin: cancel ────────────────────────────────────────────────────────
    function cancelMarket(uint256 marketId) external onlyOwner {
        address m = _requireMarket(marketId);
        PredictionMarket(m).cancel();
        emit MarketCancelled(marketId, m);
    }

    // ─── Admin: pause individual market ──────────────────────────────────────
    function pauseMarket(uint256 marketId) external onlyOwner {
        PredictionMarket(_requireMarket(marketId)).pauseMarket();
    }

    function unpauseMarket(uint256 marketId) external onlyOwner {
        PredictionMarket(_requireMarket(marketId)).unpauseMarket();
    }

    // ─── Admin: pause factory (blocks createMarket) ───────────────────────────
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Admin: fee management ────────────────────────────────────────────────
    /**
     * @notice Update platform fee for ALL future markets.
     *         Existing markets keep the fee they were deployed with.
     * @param  newFeeBps  New fee in basis points. Max 1 000 (10 %).
     */
    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "Factory: fee too high");
        uint256 old = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(old, newFeeBps);
    }

    /**
     * @notice Update the fee recipient wallet.
     *         Only affects future markets (existing markets have immutable feeRecipient).
     */
    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Factory: zero address");
        address old = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(old, newRecipient);
    }

    /**
     * @notice Sweep any USDM accidentally sent directly to this contract.
     *         Platform fees are forwarded to feeRecipient per-trade and never sit here.
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 bal = usdm.balanceOf(address(this));
        require(bal > 0, "Factory: nothing to sweep");
        usdm.safeTransfer(feeRecipient, bal);
        emit FeesSwept(feeRecipient, bal);
    }

    // ─── Views ────────────────────────────────────────────────────────────────
    function getMarketById(uint256 marketId) external view returns (address) {
        return _requireMarket(marketId);
    }

    /**
     * @notice Paginated list of market addresses, newest first.
     */
    function getMarkets(uint256 offset, uint256 limit)
        external view returns (address[] memory markets)
    {
        uint256 total = marketCount;
        if (offset >= total || limit == 0) return new address[](0);

        uint256 start = total - 1 - offset;
        uint256 count = (start + 1) < limit ? (start + 1) : limit;

        markets = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            markets[i] = _marketById[start - i];
        }
    }

    function getMarketIdsByCreator(address creator)
        external view returns (uint256[] memory)
    {
        return _marketIdsByCreator[creator];
    }

    function totalMarkets() external view returns (uint256) {
        return marketCount;
    }

    /**
     * @notice Returns current platform config (for frontend display).
     */
    function getConfig() external view returns (
        address _usdm,
        address _feeRecipient,
        uint256 _platformFeeBps,
        uint256 _marketCount,
        bool    _paused
    ) {
        return (address(usdm), feeRecipient, platformFeeBps, marketCount, paused());
    }

    // ─── Internal ─────────────────────────────────────────────────────────────
    function _requireMarket(uint256 id) internal view returns (address m) {
        m = _marketById[id];
        require(m != address(0), "Factory: market not found");
    }
}
