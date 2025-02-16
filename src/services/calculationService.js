const FIXED_FEE = 0.44; // Taxa fixa por transação

const ANTICIPATION_RATES = {
  1: 3.34,
  2: 4.88,
  3: 5.81,
  4: 6.74,
  5: 7.67,
  6: 8.60,
  7: 9.53,
  8: 10.46,
  9: 11.39,
  10: 12.32,
  11: 13.25,
  12: 14.18
};

export const calculateNetAmount = (transaction) => {
  try {
    // Se for cartão de crédito, calcula o valor líquido com as taxas
    if (transaction.payment?.method === 'credit_card') {
      const total = transaction.payment.total;
      const grossAmount = transaction.payment.gross;
      const marketplaceValue = transaction.payment.marketplace_value;
      const installments = transaction.payment.installments.qty;

      // Calcula taxa de antecipação usando o valor gross
      const anticipationRate = ANTICIPATION_RATES[installments] || ANTICIPATION_RATES[12];
      const anticipationValue = (grossAmount * anticipationRate) / 100;

      // Calcula valor líquido subtraindo todas as taxas do valor total
      const netAmount = total - marketplaceValue - FIXED_FEE - anticipationValue;

      return {
        ...transaction,
        calculation_details: {
          base_total: total,
          gross_amount: grossAmount,
          discounts: {
            marketplace_fee: marketplaceValue,
            fixed_fee: FIXED_FEE,
            anticipation_fee: anticipationValue,
            anticipation_rate: anticipationRate
          },
          net_amount: netAmount,
          installments
        }
      };
    }

    // Para outros métodos de pagamento, usa o net direto da transação
    return {
      ...transaction,
      calculation_details: {
        net_amount: transaction.payment.net
      }
    };
  } catch (error) {
    console.error('Erro ao calcular valor líquido:', error);
    throw new Error('Erro ao calcular valor líquido: ' + error.message);
  }
};

export const processTransactions = (transactions) => {
  try {
    // Processa array de transações
    const processedTransactions = transactions.map(transaction => 
      calculateNetAmount(transaction)
    );

    // Calcula totais
    const totals = processedTransactions.reduce((acc, transaction) => {
      acc.total_transactions += 1;
      acc.total_net_amount += transaction.calculation_details.net_amount;

      // Adiciona informações de taxas apenas para cartão de crédito
      if (transaction.payment?.method === 'credit_card') {
        acc.total_marketplace_fees += transaction.calculation_details.discounts.marketplace_fee;
        acc.total_anticipation_fees += transaction.calculation_details.discounts.anticipation_fee;
        acc.total_fixed_fees += FIXED_FEE;
      }

      return acc;
    }, {
      total_transactions: 0,
      total_net_amount: 0,
      total_marketplace_fees: 0,
      total_anticipation_fees: 0,
      total_fixed_fees: 0
    });

    return {
      transactions: processedTransactions,
      totals
    };
  } catch (error) {
    console.error('Erro ao processar transações:', error);
    throw new Error('Erro ao processar transações: ' + error.message);
  }
};