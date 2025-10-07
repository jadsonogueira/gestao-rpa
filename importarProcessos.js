/**
 * importarProcessos.js
 * 
 * Script para importar um arquivo JSON de processos SEI para o MongoDB.
 * Pode ser usado para importar os dados gerados pelo Power Automate Desktop.
 * 
 * Uso:
 *   node importarProcessos.js ./processos.json
 */

import fs from "fs";
import mongoose from "mongoose";

// 🟢 Ajuste a URI do seu banco (exemplo do seu projeto gestao-rpa)
const MONGO_URI = "mongodb+srv://jadsonnogueira:nqIj8jZovGHtDj22@appdnit.n4npj.mongodb.net/appdnit?retryWrites=true&w=majority";

// 🟢 Definição do Schema (padrão SEI)
const ProcessoSchema = new mongoose.Schema({
  Processo: { type: String, index: true, required: true, unique: true },
  Atribuicao: String,
  Anotacao: String,
  Tipo: String,
  Especificacao: String,
  importedAt: { type: Date, default: Date.now },
});

const Processo = mongoose.model("ProcessoSEI", ProcessoSchema);

// 🟢 Função principal
async function importar() {
  const caminho = process.argv[2];
  if (!caminho) {
    console.error("❌  Informe o caminho do arquivo JSON. Ex: node importarProcessos.js ./processos.json");
    process.exit(1);
  }

  if (!fs.existsSync(caminho)) {
    console.error(`❌  Arquivo não encontrado: ${caminho}`);
    process.exit(1);
  }

  console.log("🔗 Conectando ao MongoDB...");
  await mongoose.connect(MONGO_URI);

  console.log("📂 Lendo arquivo JSON:", caminho);
  const conteudo = fs.readFileSync(caminho, "utf8");
  const dados = JSON.parse(conteudo);

  if (!Array.isArray(dados)) {
    console.error("❌  O arquivo JSON deve conter um array de objetos.");
    process.exit(1);
  }

  console.log(`📦 Encontrados ${dados.length} registros. Limpando <wbr> e formatando...`);

  const limpar = (t) =>
    String(t ?? "")
      .replace(/<wbr\s*\/?>/gi, "")
      .replace(/\r?\n+/g, " ")
      .replace(/"/g, "'")
      .trim();

  const docs = dados.map((it) => ({
    Processo: limpar(it.Processo),
    Atribuicao: limpar(it.Atribuicao),
    Anotacao: limpar(it.Anotacao),
    Tipo: limpar(it.Tipo),
    Especificacao: limpar(it.Especificacao),
  }));

  console.log("⬆️  Importando para MongoDB...");

  const ops = docs.map((d) => ({
    updateOne: {
      filter: { Processo: d.Processo },
      update: { $set: d },
      upsert: true,
    },
  }));

  await Processo.bulkWrite(ops, { ordered: false });

  console.log(`✅ Importação concluída! ${docs.length} registros atualizados/inseridos.`);
  await mongoose.disconnect();
  process.exit(0);
}

// 🟢 Executar
importar().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});