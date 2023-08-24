'use strict';

import pg from 'pg';
const { Client } = pg;

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    schema: process.env.DB_SCHEMA,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false
    }
});

client.connect();

const s3Client = new S3Client({
    signatureVersion: 'v4',
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_KEY
    }
});

const sqsClient = new SQSClient({
    signatureVersion: 'v4',
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_KEY
    }
});


export const handler = async (event, context) => {
    console.log('Event: ' + JSON.stringify(event));
    console.log('Context: ' + JSON.stringify(context));
    try {
        let object = await s3Client.send(new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: event.detail.TranscriptionJobName + '.json',
        }));
        let transcribed = JSON.parse(await object.Body.transformToString()).results.transcripts[0].transcript;
        console.log('Transcribed: ' + transcribed);
        let ids = await client.query('select id from lingualol.message where transcribe_job_name = $1', [event.detail.TranscriptionJobName]);
        await client.query('update lingualol.message set transcribed = $1, modified = $2 where id = $3', [transcribed, new Date(), ids.rows[0].id]);
        let data = await sqsClient.send(new SendMessageCommand({
            QueueUrl: process.env.AWS_SQS_TRANSLATE,
            MessageBody: '' + ids.rows[0].id
        }));
        console.log(data);
    } catch (error) {
        console.error(error);
    }
};