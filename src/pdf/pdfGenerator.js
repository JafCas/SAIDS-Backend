const PdfPrinter = require ("pdfmake");
const fs = require("fs");

const fonts = require("./fonts");
const styles = require("./styles");
const {content} = require("./pdfContent");

let docDefinition = {
    content: content,
    styles: styles
};

const printer = new PdfPrinter(fonts);
const fileName = "hola"

let pdfDoc = printer.createPdfKitDocument(docDefinition);
//pdfDoc.pipe(fs.createWriteStream("./pdfTest.pdf"));
pdfDoc.pipe(fs.createWriteStream("./createdFiles/"+fileName+".pdf"));
pdfDoc.end();