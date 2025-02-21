// Taxas fixas
const PROCESSING_FEE = 0.44; // Taxa de processamento
const TRANSFER_FEE = 3.67; // Taxa de transferência
const BOLETO_FEE = 2.99; // Taxa de boleto
const PIX_FEE_PERCENTAGE = 0.0095; // Taxa de Pix (0.95%)

// Taxa de antecipação
const ANTICIPATION_RATE = 0.019; // 1.90% por parcela

// Taxas de cartão de crédito
const CREDIT_CARD_RATES = {
  'visa': { '1': 0.0160, '2-6': 0.0211, '7-12': 0.0211 },
  'mastercard': { '1': 0.0160, '2-6': 0.0211, '7-12': 0.0211 },
  'elo': { '1': 0.0160, '2-6': 0.0211, '7-12': 0.0211 },
  'amex': { '1': 0.0160, '2-6': 0.0211, '7-12': 0.0211 },
  'hipercard': { '1': 0.0160, '2-6': 0.0211, '7-12': 0.0211 }
};

const getCardRate = (brand, installments) => {
  if (!brand) {
    console.warn('Bandeira do cartão não fornecida, usando taxa padrão.');
    return CREDIT_CARD_RATES['visa']['7-12']; // Taxa padrão
  }

  const rates = CREDIT_CARD_RATES[brand.toLowerCase()];
  if (!rates) {
    console.warn(`Bandeira ${brand} não reconhecida, usando taxa padrão.`);
    return CREDIT_CARD_RATES['visa']['7-12']; // Taxa padrão
  }

  if (installments === 1) return rates['1'];
  if (installments >= 2 && installments <= 6) return rates['2-6'];
  return rates['7-12'];
};

const calculateNetAffiliateValue = (affiliateValue) => {
  if (!affiliateValue) return 0;

  // Aplicar as mesmas taxas que aplicamos ao valor de venda
  const grossAmount = affiliateValue;
  const mdrFee = grossAmount * CREDIT_CARD_RATES['visa']['7-12']; // Usando a taxa padrão
  const anticipationFee = (grossAmount - mdrFee) * ANTICIPATION_RATE;
  
  let netAmount = grossAmount - mdrFee - anticipationFee - PROCESSING_FEE - TRANSFER_FEE;
  
  return Math.max(netAmount, 0); // Garantir que o valor não seja negativo
};

const calculateNetAmount = (transaction) => {
  const { payment } = transaction;
  let netAmount = 0;
  let discounts = {};
  let grossAffiliateValue = payment.affiliate_value || 0;
  let netAffiliateValue = calculateNetAffiliateValue(grossAffiliateValue);

  if (!payment) {
    console.error('Dados de pagamento não encontrados na transação:', transaction);
    return transaction;
  }

  const totalAmount = payment.total || 0;

  if (payment.method === 'credit_card') {
    const installments = payment.installments?.qty || 1;
    const cardRate = getCardRate(payment.credit_card?.brand, installments);
    
    // Calcula o valor bruto (após dedução da taxa MDR)
    const grossAmount = totalAmount * (1 - cardRate);
    
    // Calcula o valor líquido por parcela
    const installmentGrossAmount = grossAmount / installments;
    
    let totalNetAmount = 0;
    for (let i = 1; i <= installments; i++) {
      const daysToAnticipate = 30 * i;
      const anticipationFee = installmentGrossAmount * ANTICIPATION_RATE * (daysToAnticipate / 30);
      const installmentNetAmount = installmentGrossAmount - anticipationFee;
      totalNetAmount += installmentNetAmount;
    }

    netAmount = totalNetAmount - PROCESSING_FEE - TRANSFER_FEE;

    discounts = {
      mdr_fee: totalAmount * cardRate,
      anticipation_fee: grossAmount - totalNetAmount,
      processing_fee: PROCESSING_FEE,
      transfer_fee: TRANSFER_FEE
    };
  } else if (payment.method === 'boleto') {
    netAmount = totalAmount - BOLETO_FEE - PROCESSING_FEE - TRANSFER_FEE;
    discounts = {
      boleto_fee: BOLETO_FEE,
      processing_fee: PROCESSING_FEE,
      transfer_fee: TRANSFER_FEE
    };
  } else if (payment.method === 'pix') {
    const pixFee = totalAmount * PIX_FEE_PERCENTAGE;
    netAmount = totalAmount - pixFee - PROCESSING_FEE - TRANSFER_FEE;
    discounts = {
      pix_fee: pixFee,
      processing_fee: PROCESSING_FEE,
      transfer_fee: TRANSFER_FEE
    };
  } else {
    // Para outros métodos de pagamento, use o net fornecido pela API
    netAmount = payment.net || totalAmount;
    discounts = {
      processing_fee: PROCESSING_FEE,
      transfer_fee: TRANSFER_FEE
    };
  }

  // Subtrair o valor líquido da afiliação do valor líquido total
  netAmount -= netAffiliateValue;

  return {
    ...transaction,
    calculation_details: {
      payment_method: payment.method,
      total_amount: totalAmount,
      net_amount: netAmount,
      discounts: discounts,
      gross_affiliate_value: grossAffiliateValue,
      net_affiliate_value: netAffiliateValue
    }
  };
};

export const processTransactions = (transactions) => {
  try {
    const processedTransactions = transactions.map(transaction => {
      try {
        return calculateNetAmount(transaction);
      } catch (error) {
        console.error('Erro ao processar transação:', error, transaction);
        return transaction;
      }
    });

    const totals = processedTransactions.reduce((acc, transaction) => {
      const details = transaction.calculation_details;
      acc.total_transactions += 1;
      acc.total_net_amount += details?.net_amount || 0;
      acc.total_net_affiliate_value += details?.net_affiliate_value || 0;
      
      if (details?.discounts) {
        Object.entries(details.discounts).forEach(([key, value]) => {
          acc[`total_${key}`] = (acc[`total_${key}`] || 0) + value;
        });
      }

      return acc;
    }, {
      total_transactions: 0,
      total_net_amount: 0,
      total_net_affiliate_value: 0
    });

    console.log('Totais calculados:', totals);

    return {
      transactions: processedTransactions.map(t => ({
        ...t,
        net_affiliate_value: t.calculation_details.net_affiliate_value
      })),
      totals
    };
  } catch (error) {
    console.error('Erro ao processar transações:', error);
    throw new Error('Erro ao processar transações: ' + error.message);
  }
};