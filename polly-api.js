'use strict';

const AWS = require('aws-sdk');
const crypto = require('crypto');
const fs = require('fs');
const audio = require('audio');

const polly = new AWS.Polly();
const s3 = new AWS.S3();

const S3BucketName = process.env.POLLY_CACHE_S3_BUCKET_NAME;
const VoiceId = 'Amy';

exports.getDefinitionAudio = function (word) {
    return objectExists(word)
        .then(exists => {
            if (exists) {
                console.log("Object exists");
                return getSignedUrl(word);
            } else {
                console.log("Object DOES NOT exist");
                return textToSpeech(word.definition)
                    .then(binaryString => saveToS3(word, binaryString))
                    .then(() => getUrl(word));
            }
        }).catch(e => console.error(e));
};

function objectExists(word) {
    return new Promise((resolve, reject) => {
        let params = {
            Bucket: S3BucketName,
            Key: objectKey(word)
        };
        s3.headObject(params, function (err, url) {
            if (err) {
                console.log(`objectExists: error ` + err);
                resolve(false);
            } else {
                console.log(`objectExists: TRUE`);
                resolve(true);
            }
        });
    });
}

function getUrl(word) {
    return `https://s3.amazonaws.com/${S3BucketName}/${objectKey(word)}`;
}

function saveToS3(word, binaryString) {
    return new Promise((resolve, reject) => {
        let params = {
            Bucket: S3BucketName,
            Key: objectKey(word),
            ACL: 'public-read',
            Body: binaryString,
            Tagging: `WordId=${word.id}&Word=${word.word}`
        };
        s3.putObject(params, function(err, data) {
            if (err) {
                console.log(`saveToS3 error: ${err}`, err.stack);
                reject(err);
            }
            else {
                console.log(`saveToS3 response: ${JSON.stringify(data)}`);
                resolve();
            }
        });
    });
}

function textToSpeech(text) {
    return new Promise((resolve, reject) => {
        let params = {
            OutputFormat: 'mp3',
            SampleRate: '22050',
            Text: text,
            TextType: 'text',
            VoiceId: VoiceId
        };
        polly.synthesizeSpeech(params, function(err, data) {
            if (err) {
                console.log(`Polly error: ${err}`, err.stack);
                reject(err);
            } else {
                console.log(`Polly response: ${JSON.stringify(data)}`);
                resolve(data.AudioStream);
            }
        });
    });
}

function objectKey(word) {
    let hash = crypto.createHash('sha1');
    hash.update(word.definition.toLowerCase());
    return hash.digest('hex') + '.mp3';
}