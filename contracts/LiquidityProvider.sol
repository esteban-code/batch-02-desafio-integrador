// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Interfaces.sol";

contract LiquidityProvider {

    IUniswapV2Router02 router = IUniswapV2Router02(routerAddress);
    IUniswapV2Factory factory = IUniswapV2Factory(factoryAddress);

    event LiquidityAmounts(
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

    function addLiquidity(
        address _tokenA,
        address _tokenB,
        uint _amountADesired,
        uint _amountBDesired,
        uint _amountAMin,
        uint _amountBMin,
        address _to,
        uint _deadline
    ) public {

        IERC20(_tokenA).transferFrom(msg.sender, address(this), _amountADesired);
        IERC20(_tokenB).transferFrom(msg.sender, address(this), _amountBDesired);

        IERC20(_tokenA).approve(routerAddress, _amountADesired);
        IERC20(_tokenB).approve(routerAddress, _amountBDesired);

        uint256 amountA;
        uint256 amountB;
        uint256 liquidity;
        (amountA, amountB, liquidity) = router.addLiquidity(
            _tokenA,
            _tokenB,
            _amountADesired,
            _amountBDesired,
            _amountAMin,
            _amountBMin,
            _to,
            _deadline
        );

        emit LiquidityAmounts(amountA, amountB, liquidity);
    }

    function getPair(
        address _tokenA,
        address _tokenB
    ) public view returns (address) {
        return factory.getPair(_tokenA, _tokenB);
    }

    function getReserves(address pairAddress) public view returns(uint112 reserve0, uint112 reserve1){
        (uint112 _reserve0, uint112 _reserve1,) = IUniswapV2Pair(pairAddress).getReserves();
        return (_reserve0, _reserve1);
    }
}
