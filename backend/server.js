  const express = require('express');
  const cors = require('cors');
  const path = require('path');
  const db = require('./config/database');
  const SSHManager = require('./config/SSHManager');


  // Importar rotas
  const authRoutes = require('./routes/auth');
  const foldersRoutes = require('./routes/folders');
  const videosRoutes = require('./routes/videos');
  const playlistsRoutes = require('./routes/playlists');
  const agendamentosRoutes = require('./routes/agendamentos');
  const comerciaisRoutes = require('./routes/comerciais');
  const downloadyoutubeRoutes = require('./routes/downloadyoutube');
  const espectadoresRoutes = require('./routes/espectadores');
  const streamingRoutes = require('./routes/streaming');
  const relayRoutes = require('./routes/relay');
  const logosRoutes = require('./routes/logos');
  const transmissionSettingsRoutes = require('./routes/transmission-settings');
  const ftpRoutes = require('./routes/ftp');
  const serversRoutes = require('./routes/servers');

  const app = express();
  const PORT = process.env.PORT || 3001;
  const isProduction = process.env.NODE_ENV === 'production';

  // Middlewares
  app.use(cors({
    origin: isProduction ? [
      'http://samhost.wcore.com.br',
      'https://samhost.wcore.com.br',
      'http://samhost.wcore.com.br:3000'
    ] : [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ],
    credentials: true
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Servir arquivos estáticos do Wowza
  // Middleware personalizado para servir arquivos de vídeo
  app.use('/content', async (req, res, next) => {
    try {
      const SSHManager = require('./config/SSHManager');
      const path = require('path');
      
      // Extrair informações do caminho
      const requestPath = req.path;
      console.log(`📹 Solicitação de vídeo: ${requestPath}`);
      
      // Verificar se é um arquivo de vídeo
      const isVideo = /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i.test(requestPath);
      
      if (!isVideo) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }
      
      // Extrair usuário e caminho do arquivo
      const pathParts = requestPath.split('/').filter(p => p);
      if (pathParts.length < 3) {
        return res.status(404).json({ error: 'Caminho inválido' });
      }
      
      const userLogin = pathParts[0];
      const folderName = pathParts[1];
      const fileName = pathParts[2];
      
      // Caminho completo no servidor Wowza
      const remotePath = `/usr/local/WowzaStreamingEngine/content/${userLogin}/${folderName}/${fileName}`;
      
      console.log(`🔍 Verificando arquivo: ${remotePath}`);
      
      // Verificar se arquivo existe no servidor via SSH
      const serverId = 1; // Usar servidor padrão por enquanto
      const fileInfo = await SSHManager.getFileInfo(serverId, remotePath);
      
      if (!fileInfo.exists) {
        console.log(`❌ Arquivo não encontrado: ${remotePath}`);
        return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
      }
      
      console.log(`✅ Arquivo encontrado: ${remotePath}`);
      
      // Configurar headers para streaming de vídeo
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Para desenvolvimento, redirecionar para URL direta do Wowza
      const isProduction = process.env.NODE_ENV === 'production';
      const wowzaUrl = isProduction ? 
        `http://51.222.156.223:1935/samhost${requestPath}` :
        `http://51.222.156.223:1935/samhost${requestPath}`;
      
      console.log(`🔗 Redirecionando para: ${wowzaUrl}`);
      
      // Fazer proxy da requisição para o servidor Wowza
      const fetch = require('node-fetch');
      
      try {
        const wowzaResponse = await fetch(wowzaUrl, {
          method: req.method,
          headers: {
            'Range': req.headers.range || '',
            'User-Agent': 'Streaming-System/1.0'
          }
        });
        
        if (!wowzaResponse.ok) {
          console.log(`❌ Erro do Wowza: ${wowzaResponse.status}`);
          return res.status(404).json({ error: 'Vídeo não disponível no servidor de streaming' });
        }
        
        // Copiar headers da resposta do Wowza
        wowzaResponse.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
        
        // Fazer pipe do stream
        wowzaResponse.body.pipe(res);
        
      } catch (fetchError) {
        console.error('❌ Erro ao acessar Wowza:', fetchError);
        return res.status(500).json({ error: 'Erro interno do servidor de streaming' });
      }
      
    } catch (error) {
      console.error('❌ Erro no middleware de vídeo:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  // Servir arquivos estáticos do frontend em produção
  if (isProduction) {
    app.use(express.static(path.join(__dirname, '../dist')));
    
    // Catch all handler: send back React's index.html file for SPA routing
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
      }
    });
  }

  // Rotas da API
  app.use('/api/auth', authRoutes);
  app.use('/api/folders', foldersRoutes);
  app.use('/api/videos', videosRoutes);
  app.use('/api/playlists', playlistsRoutes);
  app.use('/api/agendamentos', agendamentosRoutes);
  app.use('/api/comerciais', comerciaisRoutes);
  app.use('/api/downloadyoutube', downloadyoutubeRoutes);
  app.use('/api/espectadores', espectadoresRoutes);
  app.use('/api/streaming', streamingRoutes);
  app.use('/api/relay', relayRoutes);
  app.use('/api/logos', logosRoutes);
  app.use('/api/transmission-settings', transmissionSettingsRoutes);
  app.use('/api/ftp', ftpRoutes);
  app.use('/api/servers', serversRoutes);

  // Rota de teste
  app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando!', timestamp: new Date().toISOString() });
  });

  // Rota de health check
  app.get('/api/health', async (req, res) => {
    try {
      const dbConnected = await db.testConnection();
      res.json({
        status: 'ok',
        database: dbConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Middleware de tratamento de erros
  app.use((error, req, res, next) => {
    console.error('Erro não tratado:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Arquivo muito grande' });
    }
    
    if (error.message.includes('Tipo de arquivo não suportado')) {
      return res.status(400).json({ error: 'Tipo de arquivo não suportado' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  });

  // Rota 404
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  // Iniciar servidor
  async function startServer() {
    try {
      // Testar conexão com banco
      const dbConnected = await db.testConnection();
      
      if (!dbConnected) {
        console.error('❌ Não foi possível conectar ao banco de dados');
        process.exit(1);
      }

      app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
        console.log(`🔧 API test: http://localhost:${PORT}/api/test`);
        console.log(`🔗 SSH Manager inicializado para uploads remotos`);
      });
      
      // Cleanup ao fechar aplicação
      process.on('SIGINT', () => {
        console.log('\n🔌 Fechando conexões SSH...');
        SSHManager.closeAllConnections();
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        console.log('\n🔌 Fechando conexões SSH...');
        SSHManager.closeAllConnections();
        process.exit(0);
      });
    } catch (error) {
      console.error('❌ Erro ao iniciar servidor:', error);
      process.exit(1);
    }
  }

  startServer();