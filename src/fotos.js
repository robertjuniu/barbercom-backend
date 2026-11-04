import express from 'express';
import sharp from 'sharp';

export function createPhotoRouter(db) {
  const router = express.Router();
  router.post('/:id/foto', express.raw({ type: ['image/jpeg', 'image/png'], limit: '2mb' }), async (req, res) => {
    if (!/^[1-9]\d{0,17}$/.test(req.params.id)) return res.status(404).json({ erro: 'Profissional não encontrado.' });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ erro: 'Envie o arquivo JPEG ou PNG no corpo da requisição.' });
    let dados;
    try {
      const image = sharp(req.body, { limitInputPixels: 16000000, failOn: 'warning' });
      const metadata = await image.metadata();
      if (!['jpeg', 'png'].includes(metadata.format) || metadata.pages > 1) throw new Error('Formato inválido');
      dados = await image.rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch { return res.status(400).json({ erro: 'Imagem inválida. Use JPEG ou PNG de até 2 MB e 16 milhões de pixels.' }); }
    const foto_url = `/fotos/profissionais/${req.params.id}`;
    // Uma instrução grava arquivo e referência juntos; não cria arquivos órfãos no disco.
    const { rowCount } = await db.query(`WITH profissional_atualizado AS (
      UPDATE profissional SET foto_url=$2 WHERE id=$1 RETURNING id)
      INSERT INTO foto_profissional(profissional_id,dados) SELECT id,$3 FROM profissional_atualizado
      ON CONFLICT(profissional_id) DO UPDATE SET dados=EXCLUDED.dados`, [req.params.id, foto_url, dados]);
    if (!rowCount) return res.status(404).json({ erro: 'Profissional não encontrado.' });
    res.json({ mensagem: 'Foto atualizada.', foto_url });
  });
  return router;
}

export async function sendPhoto(db, req, res) {
  if (!/^[1-9]\d{0,17}$/.test(req.params.id)) return res.sendStatus(404);
  const { rows: [foto] } = await db.query('SELECT dados FROM foto_profissional WHERE profissional_id=$1', [req.params.id]);
  if (!foto) return res.sendStatus(404);
  res.type('jpeg').send(foto.dados);
}
