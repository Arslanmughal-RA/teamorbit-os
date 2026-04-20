import { WebClient, type Block, type KnownBlock } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function sendDirectMessage(
  slackUserId: string,
  blocks: (Block | KnownBlock)[],
  text: string
) {
  const conversation = await slack.conversations.open({ users: slackUserId });
  if (!conversation.channel?.id) throw new Error('Failed to open DM');

  await slack.chat.postMessage({
    channel: conversation.channel.id,
    text,
    blocks,
  });
}
