const cron = require('node-cron');

function startCronJob(intervalMinutes, callback) {
    // Convert minutes to cron expression
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    // Create and start the cron job
    const job = cron.schedule(cronExpression, callback, {
        scheduled: true,
        timezone: "UTC"
    });

    console.log(`Started cron job with interval: ${intervalMinutes} minutes`);
    return job;
}

function stopCronJob(job) {
    if (job) {
        job.stop();
        console.log('Stopped cron job');
    }
}

module.exports = {
    startCronJob,
    stopCronJob
}; 