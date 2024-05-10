import { EngineContract_ConditionalOrderExecuted_handler, EngineContract_ConditionalOrderExecuted_loader, EngineContract_Credited_handler, EngineContract_Credited_loader, EngineContract_Debited_handler, EngineContract_Debited_loader } from "../generated/src/Handlers.gen";

EngineContract_Credited_loader(({ event, context }) => {
  context.Account.load(event.params.accountId.toString())
})

EngineContract_Credited_handler(({ event, context }) => {
  const account = context.Account.get(event.params.accountId.toString())

  if (!account) {
    throw new Error('Account not found')
  }

  context.CreditDebitEvent.set({
    id: event.transactionHash + '-' + event.logIndex.toString(),
    accountId: event.params.accountId,
    amount: event.params.amount,
    block: BigInt(event.blockNumber),
    timestamp: BigInt(event.blockTimestamp),
    txHash: event.transactionHash,
  })

  context.Account.set({
    ...account,
    credit: account.credit + event.params.amount,
  })
})

EngineContract_Debited_loader(({ event, context }) => {
  context.Account.load(event.params.accountId.toString())
})

EngineContract_Debited_handler(({ event, context }) => {
  const account = context.Account.get(event.params.accountId.toString())

  if (!account) {
    throw new Error('Account not found')
  }

  context.CreditDebitEvent.set({
    id: event.transactionHash + '-' + event.logIndex.toString(),
    accountId: event.params.accountId,
    amount: -event.params.amount,
    block: BigInt(event.blockNumber),
    timestamp: BigInt(event.blockTimestamp),
    txHash: event.transactionHash,
  })

  context.Account.set({
    ...account,
    credit: account.credit - event.params.amount,
  })
})

EngineContract_ConditionalOrderExecuted_loader(({ event, context }) => {
  context.Account.load(event.params.order[1][1].toString())
})

EngineContract_ConditionalOrderExecuted_handler(({ event, context }) => {
  const account = context.Account.get(event.params.order[1][1].toString())

  if (!account) {
    throw new Error('Account not found')
  }

  context.CreditDebitEvent.set({
    id: event.transactionHash + '-' + event.logIndex.toString(),
    accountId: event.params.order[1][1],
    amount: -event.params.executorFee,
    block: BigInt(event.blockNumber),
    timestamp: BigInt(event.blockTimestamp),
    txHash: event.transactionHash,
  })

  context.Account.set({
    ...account,
    credit: account.credit - event.params.executorFee,
  })
})
