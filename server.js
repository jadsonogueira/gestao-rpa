const { fromPath } = require("pdf2pic");

// Função para converter PDF para JPG
async function convertPdfToJpg(pdfBuffer) {
  const tempPdfPath = "./temp.pdf";
  const fs = require("fs");

  // Salvar o PDF em um arquivo temporário
  fs.writeFileSync(tempPdfPath, pdfBuffer);

  const options = {
    density: 200,
    savePath: "./",
    format: "jpg",
    width: 800,
    height: 600
  };

  const converter = fromPath(tempPdfPath, options);

  try {
    const images = await converter.bulk(-1);
    console.log("Conversão concluída:", images);
    return images.map(img => img.path);
  } catch (error) {
    console.error("Erro ao converter PDF:", error);
    return [];
  }
}
