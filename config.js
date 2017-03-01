module.exports = {
    DECISION_LAMBDA: {
        accessKeyId: process.env['DECISION_LAMBDA_KEY'],
        secretAccessKey: process.env['DECISION_LAMBDA_SECRET_KEY'],
        region: process.env['AWS_S3_REGION']
    },
    S3_BUCKET: {
        accessKeyId: process.env['S3_KEY'],
        secretAccessKey: process.env['S3_SECRET_KEY'],
        region: process.env['AWS_S3_REGION']
    },
    FETCH_SVC: {
        host: process.env['FETCH_HOST'],
        port: process.env['FETCH_PORT']
    }
}
