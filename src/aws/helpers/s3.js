const S3 = require('aws-sdk/clients/s3');
const fs = require('fs'); //file system

//Configuración de variables para comunicación usando el SDK
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const storage = new S3({
    region,
    accessKeyId,
    secretAccessKey
});

//lista buckets
const getBuckets = () => {
    return storage.listBuckets().promise();
}

//Carga archivo al bucket
const uploadBucket = (bucketName, file) => {
    const stream = fs.createReadStream(file.tempFilePath);
    const params = {
        Bucket: bucketName,
        Key: file.name,
        Body: stream
    };
    return storage.upload(params).promise();
}

module.exports = {
    getBuckets,
    uploadBucket
}