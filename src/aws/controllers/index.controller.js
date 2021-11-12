const {getBuckets} = require('../helpers/s3')
const index = async (req, res) => {
    const data = await getBuckets();
    console.log(data.Buckets);
    res.render('index', {
        buckets: data.Buckets
    });
};

module.exports = {
    index
}