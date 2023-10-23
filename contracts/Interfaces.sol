// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

address constant routerAddress = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
address constant factoryAddress = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol"; //para obtener decimals() de BBToken
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20PermitUpgradeable.sol";

interface IUniswapV2Router02 {

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    // Conozco la cantidad de tokens B que quiero obtener
    // No sé cuántos tokens A voy a pagar
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsIn(
        uint amountOut,
        address[] calldata path
    ) external view returns (uint[] memory amounts);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
}

interface IUniswapV2Factory {
    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address pair);
}

interface IUniswapV2Pair {
    function getReserves()
        external
        view
        returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

interface IERC20MetadaPermitUpgradeable is IERC20MetadataUpgradeable, IERC20PermitUpgradeable{

}
