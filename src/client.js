import axios from 'axios';

export class DMGClient {
  constructor(token) {
    if (!token) {
      throw new Error('Token é obrigatório');
    }
    this.token = token;
    this.client = null;
  }

  initialize() {
    console.log('Inicializando cliente DMG...');
    
    this.client = axios.create({
      baseURL: 'https://digitalmanager.guru/api/v2',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Cliente DMG inicializado com sucesso');
  }
  async getRefundedTransactions(filters = {}) {
    try {
      this.ensureInitialized();
  
      const allTransactions = [];
      let nextCursor = null;
      let totalRows = null;
      let hasMore = true;
  
      console.log('Iniciando busca de transações reembolsadas com filtros:', filters);
  
      // Primeira chamada para obter o total de registros
      const firstResponse = await this.client.get('/transactions', { 
        params: {
          ...filters,
          'transaction_status[]': 'refunded'
        }
      });
  
      const {
        data: firstPageData,
        has_more_pages: firstHasMore,
        next_cursor: firstNextCursor,
        total_rows: firstTotalRows
      } = firstResponse.data;
  
      totalRows = firstTotalRows;
      nextCursor = firstNextCursor;
      hasMore = firstHasMore;
      
      allTransactions.push(...firstPageData);
  
      console.log('Primeira página de reembolsos:', {
        registrosObtidos: firstPageData.length,
        totalRegistros: totalRows,
        temMaisPaginas: hasMore,
        cursor: nextCursor
      });
  
      // Busca as páginas restantes
      while (hasMore && nextCursor && allTransactions.length < totalRows) {
        console.log(`Buscando próxima página de reembolsos. Progresso: ${allTransactions.length}/${totalRows}`);
  
        const response = await this.client.get('/transactions', {
          params: {
            ...filters,
            'transaction_status[]': 'refunded',
            cursor: nextCursor
          }
        });
  
        const { 
          data: pageData, 
          has_more_pages: stillHasMore,
          next_cursor: newCursor
        } = response.data;
  
        allTransactions.push(...pageData);
        hasMore = stillHasMore;
        nextCursor = newCursor;
  
        console.log('Página de reembolsos processada:', {
          registrosNestaPagina: pageData.length,
          totalAcumulado: allTransactions.length,
          totalEsperado: totalRows,
          temMaisPaginas: hasMore,
          proximoCursor: nextCursor
        });
      }
  
      console.log('Busca de reembolsos finalizada:', {
        totalRegistrosObtidos: allTransactions.length,
        totalEsperado: totalRows,
        registrosFaltando: totalRows - allTransactions.length
      });
  
      return {
        data: allTransactions,
        has_more_pages: false,
        on_first_page: true,
        on_last_page: true,
        per_page: allTransactions.length,
        total_rows: totalRows
      };
  
    } catch (error) {
      console.error('Erro ao buscar reembolsos:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      throw error;
    }
  }

  async getTransactions(filters = {}) {
    try {
      this.ensureInitialized();

      const allTransactions = [];
      let nextCursor = null;
      let totalRows = null;
      let hasMore = true;  // Mudado para let

      console.log('Iniciando busca de transações com filtros:', filters);

      // Primeira chamada para obter o total de registros
      const firstResponse = await this.client.get('/transactions', { 
        params: {
          ...filters,
          'transaction_status[]': 'approved'
        }
      });

      const {
        data: firstPageData,
        has_more_pages: firstHasMore,
        next_cursor: firstNextCursor,
        total_rows: firstTotalRows
      } = firstResponse.data;

      totalRows = firstTotalRows;
      nextCursor = firstNextCursor;
      hasMore = firstHasMore;
      
      allTransactions.push(...firstPageData);

      console.log('Primeira página:', {
        registrosObtidos: firstPageData.length,
        totalRegistros: totalRows,
        temMaisPaginas: hasMore,
        cursor: nextCursor
      });

      // Busca as páginas restantes
      while (hasMore && nextCursor && allTransactions.length < totalRows) {
        console.log(`Buscando próxima página. Progresso: ${allTransactions.length}/${totalRows}`);

        const response = await this.client.get('/transactions', {
          params: {
            ...filters,
            'transaction_status[]': 'approved',
            cursor: nextCursor
          }
        });

        const { 
          data: pageData, 
          has_more_pages: stillHasMore,
          next_cursor: newCursor
        } = response.data;

        allTransactions.push(...pageData);
        hasMore = stillHasMore;
        nextCursor = newCursor;

        console.log('Página processada:', {
          registrosNestaPagina: pageData.length,
          totalAcumulado: allTransactions.length,
          totalEsperado: totalRows,
          temMaisPaginas: hasMore,
          proximoCursor: nextCursor
        });
      }

      console.log('Busca finalizada:', {
        totalRegistrosObtidos: allTransactions.length,
        totalEsperado: totalRows,
        registrosFaltando: totalRows - allTransactions.length
      });

      return {
        data: allTransactions,
        has_more_pages: false,
        on_first_page: true,
        on_last_page: true,
        per_page: allTransactions.length,
        total_rows: totalRows
      };

    } catch (error) {
      console.error('Erro ao buscar transactions:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      throw error;
    }
  }

  ensureInitialized() {
    if (!this.client) {
      this.initialize();
    }
  }
}