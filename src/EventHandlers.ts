import { PerpsV3MarketProxyContract_AccountCreated_handler, PerpsV3MarketProxyContract_AccountCreated_loader, PerpsV3MarketProxyContract_MarketCreated_handler, PerpsV3MarketProxyContract_MarketCreated_loader, PerpsV3MarketProxyContract_OrderSettled_handler, PerpsV3MarketProxyContract_OrderSettled_loader, PerpsV3MarketProxyContract_PositionLiquidated_handler, PerpsV3MarketProxyContract_PositionLiquidated_loader } from "../generated/src/Handlers.gen";
import { ETHER, getAbs } from "./helpers/bigint";

PerpsV3MarketProxyContract_MarketCreated_loader(({ event, context }) => {
  context.PerpsV3Market.load(event.params.perpsMarketId.toString())
})

PerpsV3MarketProxyContract_MarketCreated_handler(({ event, context }) => {
  context.PerpsV3Market.set({
    id: event.params.perpsMarketId.toString(),
    lastPrice: BigInt(0),
    marketSymbol: event.params.marketSymbol,
    marketName: event.params.marketName,
    interestRate: undefined,
  })
})


PerpsV3MarketProxyContract_AccountCreated_loader(({ event, context }) => {
  context.Account.load(event.params.accountId.toString())
})

PerpsV3MarketProxyContract_AccountCreated_handler(({ event, context }) => {
  const id = event.params.accountId.toString()
  const account = context.Account.get(id)

  if (!account) {
    context.Account.set({
      id,
      owner: event.params.owner,
      created_at: BigInt(event.blockTimestamp),
      created_at_block: BigInt(event.blockNumber),
      updated_at: BigInt(event.blockTimestamp),
      updated_at_block: BigInt(event.blockNumber),
    })
  }
})

PerpsV3MarketProxyContract_PositionLiquidated_loader(({ event, context }) => {
  context.PerpsV3Market.load(event.params.marketId.toString())
  context.Account.load(event.params.accountId.toString())

  const positionId = `${event.params.marketId.toString()}-${event.params.accountId.toString()}`;
  context.OpenPerpsV3Position.load(positionId, { loadPosition: { loadAccount: true } });
})

PerpsV3MarketProxyContract_PositionLiquidated_handler(({ event, context }) => {
  const positionId = `${event.params.marketId.toString()}-${event.params.accountId.toString()}`;
  const openPosition = context.OpenPerpsV3Position.get(positionId);

  const account = context.Account.get(event.params.accountId.toString());
  const market = context.PerpsV3Market.get(event.params.marketId.toString());

  if (!market) {
    throw new Error(`Market ${event.params.marketId.toString()} not found`);
  }

  if (!account) {
    throw new Error(`Account ${event.params.accountId.toString()} not found`);
  }

  const estNotionalSize = getAbs(getAbs(event.params.amountLiquidated) * market.lastPrice / ETHER)

  const liquidationId = `${positionId}-${event.blockTimestamp.toString()}`;
  context.PositionLiquidation.set({
    id: liquidationId,
    marketId: event.params.marketId,
    accountId: event.params.accountId,
    amount: event.params.amountLiquidated,
    accountOwner: account.owner,
    notionalAmount: estNotionalSize,
    estimatedPrice: market.lastPrice,
    timestamp: BigInt(event.blockTimestamp),
    position_id: positionId,
  })

  const statId = `${event.params.accountId.toString()}-${account.owner}`;
  const stat = context.PerpsV3Stat.get(statId);

  if (!openPosition) {
    console.warn(`Open position ${positionId} not found`);
    return;
  } else if (openPosition.position_id) {
    const position = context.PerpsV3Position.get(openPosition.position_id);
    if (position) {
      context.PerpsV3Position.set({
        ...position,
        isLiquidated: true,
        liquidation_id: liquidationId,
        isOpen: false,
      })

      context.OpenPerpsV3Position.set({
        ...openPosition,
        position_id: undefined,
      })

      if (stat) {
        context.PerpsV3Stat.set({
          ...stat,
          liquidations: stat.liquidations + BigInt(1),
        })
      }
    }
  }
})

PerpsV3MarketProxyContract_OrderSettled_loader(({ event, context }) => {
  // const orderId = `${event.params.accountId.toString()}-${event.blockTimestamp.toString()}`;
  const pendingOrderId = `${event.params.accountId.toString()}-${event.params.marketId.toString()}`;
  const openPositionId = `${event.params.marketId.toString()}-${event.params.accountId.toString()}`;

  context.PendingOrder.load(pendingOrderId)
  context.InterestCharged.load(`${event.params.accountId.toString()}-${event.transactionHash}`)
  context.OpenPerpsV3Position.load(openPositionId, { loadPosition: { loadAccount: true, loadLiquidation: { loadPosition: undefined } } })
  // context.PerpsV3Position.load
  context.Account.load(event.params.accountId.toString())
  // context.PerpsV3Stat.load
  // context.PerpsV3Market.load()

})

PerpsV3MarketProxyContract_OrderSettled_handler(({ event, context }) => {
  const pendingOrderId = `${event.params.accountId.toString()}-${event.params.marketId.toString()}`;
  const orderId = `${event.params.accountId.toString()}-${event.blockTimestamp.toString()}`;

  const pendingOrder = context.PendingOrder.get(pendingOrderId);
  const account = context.Account.get(event.params.accountId.toString())

  if (!account) {
    console.warn(`Account ${event.params.accountId} not found`)
    return
  }

  const openPositionId = `${event.params.marketId.toString()}-${event.params.accountId.toString()}`;
  const openPosition = context.OpenPerpsV3Position.get(openPositionId)

  const interestCharged = context.InterestCharged.get(`${event.params.accountId.toString()}-${event.transactionHash}`)

  const statId = `${account.id}-${account.owner}`
  const stat = context.PerpsV3Stat.get()
  context.OrderSettled.set({
    id: orderId,
    accountId: event.params.accountId,
    account_id: event.params.accountId.toString(),
    txnHash: event.transactionHash,
    accruedFunding: event.params.accruedFunding,
    collectedFees: event.params.collectedFees,
    fillPrice: event.params.fillPrice,
    marketId: event.params.marketId,
    timestamp: BigInt(event.blockTimestamp),
    totalFees: event.params.totalFees,
    trackingCode: event.params.trackingCode,
    settlementReward: event.params.settlementReward,
    sizeDelta: event.params.sizeDelta,
    newSize: event.params.newSize,
    referralFees: event.params.referralFees,
    settler: event.params.settler,
    pnl: BigInt(0),
    orderCommitted_id: pendingOrder?.id,
    interestCharged: interestCharged?.interest,
    position_id: openPosition?.position_id
  })
})
