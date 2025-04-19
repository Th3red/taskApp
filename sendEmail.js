const sendMail = require('@sendgrid/mail');
sendMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendTaskAssignedEmail(toEmail, username, taskTitle) {
  const msg = {
    to: toEmail,
    from: process.env.EMAIL_FROM,
    subject: 'New Task Assigned',
    text: `Hello ${username}, you have been assigned a new task: "${taskTitle}".`,
    html: `<p>Hello <strong>${username}</strong>,</p><p>You have been assigned a new task: <em>${taskTitle}</em>.</p>`
  };

  try {
    await sendMail.send(msg);
    console.log(`Email sent to ${toEmail}`);
  } catch (error) {
    console.error('SendGrid error:', error.response?.body || error);
  }
}

module.exports = { sendTaskAssignedEmail };
