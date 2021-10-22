const PdfPrinter = require ("pdfmake");
const fs = require("fs");

const fonts = require("./components/fonts");
const styles = require("./components/styles");
const {content} = require("./components/pdfContent");

let docDefinition = {
    content: content,
    styles: styles
};

const printer = new PdfPrinter(fonts);
const fileName = "hola2"

let pdfDoc = printer.createPdfKitDocument(docDefinition);
//pdfDoc.pipe(fs.createWriteStream("./pdfTest.pdf"));
pdfDoc.pipe(fs.createWriteStream("./createdFiles/"+fileName+".pdf"));
pdfDoc.end();