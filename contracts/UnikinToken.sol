// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract UniKinToken is ERC20, ERC20Capped, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Limite du faucet par appel (ex: 10 UKT)
    uint256 public constant FAUCET_AMOUNT = 10 * 10 ** 18;
    mapping(address => uint256) public lastFaucetClaim;

    // Configuration du Vesting (Acquisition progressive)
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 startTime;
        uint256 duration;
    }
    mapping(address => VestingSchedule) public vestingSchedules;

    constructor(uint256 initialSupply) 
        ERC20("UniKin Token", "UKT") 
        ERC20Capped(1000000 * 10 ** decimals()) // Plafond à 1 million de tokens
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    // Fonction Faucet modifiée pour un délai de 2 minutes et vérification de la pause
    function requestFaucet() external whenNotPaused {
        require(block.timestamp - lastFaucetClaim[msg.sender] >= 2 minutes, "Attendez 2 minutes avant de re-demander des tokens.");
        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    // --- GESTION DU VESTING ---
    function createVestingSchedule(address beneficiary, uint256 amount, uint256 durationInDays) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(beneficiary != address(0), "Adresse invalide");
        require(vestingSchedules[beneficiary].totalAmount == 0, "Programme deja existant");

        _transfer(msg.sender, address(this), amount);

        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            claimedAmount: 0,
            startTime: block.timestamp,
            duration: durationInDays * 1 days
        });
    }

    function claimVestedTokens() external whenNotPaused {
        VestingSchedule storage schedule = vestingSchedules[msg.sender];
        require(schedule.totalAmount > 0, "Aucun programme de vesting.");

        uint256 vested = calculateVestedAmount(msg.sender);
        uint256 claimable = vested - schedule.claimedAmount;
        require(claimable > 0, "Aucun token disponible a reclamer pour l'instant.");

        schedule.claimedAmount += claimable;
        _transfer(address(this), msg.sender, claimable);
    }

    function calculateVestedAmount(address beneficiary) public view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        if (block.timestamp < schedule.startTime) return 0;
        if (block.timestamp >= schedule.startTime + schedule.duration) return schedule.totalAmount;

        return (schedule.totalAmount * (block.timestamp - schedule.startTime)) / schedule.duration;
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // Surcharge obligatoire pour Solidity / OpenZeppelin v5
    function _update(address from, address to, uint256 value) 
        internal 
        override(ERC20, ERC20Capped, ERC20Pausable) 
    {
        super._update(from, to, value);
    }
}