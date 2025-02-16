import { Router } from 'express';
import { DMGClient } from '../client.js';
import { processTransactions } from '../services/calculationService.js';
import { config } from '../config.js';

const router = Router();
let dmgClient = null;

// Middleware para garantir que o cliente está inicializado
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

// Rota para listar transactions
router.post('/transactions', ensureInitialized, async (req, res) => {
  try {
    console.log('Recebida requisição com body:', req.body);

    // Se não houver datas, usa últimos 7 dias como padrão
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const filters = {
      ordered_at_ini: req.body.ordered_at_ini || startDate.toISOString().split('T')[0],
      ordered_at_end: req.body.ordered_at_end || endDate.toISOString().split('T')[0]
    };

    console.log('Filtros a serem aplicados:', filters);

    // Busca todas as transações de todas as páginas
    const response = await dmgClient.getTransactions(filters);
    
    // Processa as transações com o serviço de cálculo
    const processedData = processTransactions(response.data);

    // Log dos totais para debug
    console.log('Totais processados:', {
      total_transactions: processedData.totals.total_transactions,
      total_net_amount: processedData.totals.total_net_amount
    });

    res.json({
      data: processedData.transactions,
      totals: processedData.totals,
      total_rows: response.total_rows
    });
  } catch (error) {
    console.error('Erro ao buscar transactions:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar transactions',
      message: error.message,
      details: error.response?.data 
    });
  }
});

export default router;