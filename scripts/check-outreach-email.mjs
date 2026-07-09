import 'dotenv/config';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';

function mask(value) {
  if (!value) return '(unset)';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

async function testSmtp() {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT ?? '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const from = process.env.OUTREACH_EMAIL_FROM;

  console.log('SMTP config:', { host, port, user: mask(user), from });

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.verify();
  const info = await transporter.sendMail({
    from,
    to: user,
    subject: 'RelayDispatch outreach SMTP test',
    text: 'SMTP connectivity test successful.',
  });
  console.log('SMTP send test: OK', { messageId: info.messageId });
}

async function testImap() {
  const host = process.env.IMAP_HOST;
  const port = Number(process.env.IMAP_PORT ?? '993');
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASS;

  console.log('IMAP config:', { host, port, user: mask(user) });

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      let latest = null;
      for await (const msg of client.fetch('1:*', { uid: true, envelope: true }, { uid: true })) {
        latest = msg;
      }
      if (!latest) {
        console.log('IMAP read test: OK (connected, inbox empty)');
      } else {
        const from = latest.envelope?.from?.[0]?.address ?? '(unknown)';
        const subject = latest.envelope?.subject ?? '(no subject)';
        console.log('IMAP read test: OK', { latestUid: latest.uid, from, subject });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

async function main() {
  try {
    await testSmtp();
  } catch (err) {
    console.error('SMTP test FAILED:', err);
    process.exitCode = 1;
  }

  try {
    await testImap();
  } catch (err) {
    console.error('IMAP test FAILED:', err);
    process.exitCode = 1;
  }
}

await main();

