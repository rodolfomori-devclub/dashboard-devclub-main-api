import { Router } from 'express';
import { DMGClient } from '../client.js';
import { processTransactions } from '../services/calculationService.js';
import { config } from '../config.js';

const router = Router();
let dmgClient = null;

const ensureInitialized = async (req, res, next) => {
  try {
    if (!dmgClient) {
      console.log('Criando nova instância do cliente DMG');
      dmgClient = new DMGClient(config.token);
      dmgClient.initialize();
    }
    next();
  } catch (error) {
    console.error('Erro ao inicializar cliente DMG:', error);
    res.status(500).json({ 
      error: 'Erro ao conectar com a API',
      details: error.message 
    });
  }
};

router.post('/transactions', ensureInitialized, async (req, res) => {
  try {
    console.group('🔍 Requisição de Transactions');
    console.log('Body recebido:', JSON.stringify(req.body, null, 2));

    let startDate = req.body.ordered_at_ini 
      ? new Date(req.body.ordered_at_ini) 
      : new Date(new Date().setDate(new Date().getDate() - 7));
    
    let endDate = req.body.ordered_at_end 
      ? new Date(req.body.ordered_at_end) 
      : new Date();

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    const splitDateRanges = (start, end) => {
      const ranges = [];
      let currentStart = new Date(start);
      let currentEnd = new Date(start);
    
      while (currentStart <= end) {
        currentEnd = new Date(currentStart);
        currentEnd.setDate(currentStart.getDate() + 179);
        
        if (currentEnd > end) {
          currentEnd = new Date(end);
        }
    
        ranges.push({
          start: currentStart.toISOString().split('T')[0],
          end: currentEnd.toISOString().split('T')[0]
        });
    
        currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() + 1);
      }
    
      return ranges;
    };

    const dateRanges = splitDateRanges(startDate, endDate);
    console.log('Períodos divididos:', dateRanges);

    const allTransactions = [];
    let totalNetAmount = 0;
    let totalTransactions = 0;

    for (const range of dateRanges) {
      const filters = {
        ordered_at_ini: range.start,
        ordered_at_end: range.end
      };

      console.log('Buscando transações para o período:', filters);

      try {
        const response = await dmgClient.getTransactions(filters);
        
        const processedData = processTransactions(response.data);

        allTransactions.push(...processedData.transactions);
        totalNetAmount += processedData.totals.total_net_amount;
        totalTransactions += processedData.totals.total_transactions;

        console.log('Parcial:', {
          periodStart: range.start,
          periodEnd: range.end,
          periodTransactions: processedData.transactions.length,
          periodNetAmount: processedData.totals.total_net_amount
        });
      } catch (periodError) {
        console.error(`Erro ao buscar período ${range.start} - ${range.end}:`, periodError);
      }
    }

    console.log('Totais finais:', {
      total_transactions: totalTransactions,
      total_net_amount: totalNetAmount
    });

    console.groupEnd();

    res.json({
      data: allTransactions,
      totals: {
        total_transactions: totalTransactions,
        total_net_amount: totalNetAmount
      },
      total_rows: allTransactions.length
    });
  } catch (error) {
    console.error('Erro detalhado ao buscar transactions:', {
      message: error.message,
      stack: error.stack,
      responseData: error.response?.data
    });
    res.status(500).json({ 
      error: 'Erro ao buscar transactions',
      message: error.message,
      details: error.response?.data || error.stack
    });
  }
});

export default router;