import type { VercelApiHandler } from '@vercel/node';
import axios from 'axios';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

function unorderedList<T>(items: T[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

const codeBlock = (text: string, lang = '') => `\`\`\`${lang}\n${text}\n\`\`\``;

const toDataList = (data: {
  roomName: string;
  floor: number;
  location: { x: number; y: number } | undefined;
}) => {
  const dataList = [`Room Name: ${data.roomName}`, `Floor: ${data.floor}`];

  if (data.location) {
    const { x, y } = data.location;
    dataList.push(
      `Location: [${y}, ${x}](https://www.openstreetmap.org/?mlat=${y}&mlon=${x}#map=19/${y}/${x})`,
    );
  }

  return unorderedList(dataList);
};

async function handle(
  venue: string,
  roomName: string,
  latlng: number[] | null = null,
  floor: number,
  comment: string | null = null,
  reporterName: string | null = null,
  reporterEmail: string | null = null,
  debug = false,
) {
  console.log({
    venue,
    room: roomName,
    latlng,
    floor,
    comment,
    reporterName,
    reporterEmail,
  });

  // Get current version of the venue
  let currentVenue;
  let currentVenueError;

  try {
    const response = await axios.get('https://github.nusmods.com/venues');
    const currentVenues = response.data;
    currentVenue = currentVenues[venue];
  } catch (e) {
    currentVenueError = e;
  }

  const data: {
    roomName: string;
    floor: number;
    location: { x: number; y: number } | undefined;
  } = {
    roomName,
    floor,
  };

  if (latlng) {
    // TODO: Check latlng param validity
    const [y, x] = latlng;
    data.location = { x, y };
  }

  const paragraphs = [toDataList(data)];

  if (comment) {
    paragraphs.push('**Reporter comment:**');
    paragraphs.push(comment);
  }

  if (currentVenue) {
    const json = JSON.stringify(currentVenue, null, 2);
    paragraphs.push('**Current version:**');
    paragraphs.push(codeBlock(json, 'json'));
  } else if (currentVenueError) {
    paragraphs.push('**Error fetching current version**');
    paragraphs.push(codeBlock(currentVenueError.stack));
  } else {
    paragraphs.push('**Venue does not exist in current version**');
  }

  paragraphs.push('**Update proposed:**');
  paragraphs.push(codeBlock(`"${venue}": ${JSON.stringify(data, null, 2)}`, 'json'));

  if (reporterName || reporterEmail) {
    if (reporterName && reporterEmail) {
      paragraphs.unshift(`Reporter: ${reporterName} (${reporterEmail})`);
    } else {
      paragraphs.unshift(`Reporter: ${reporterName || reporterEmail}`);
    }
  }

  const body = paragraphs.join('\n\n');
  console.log(body);

  if (!process.env.MOCK_GITHUB && !debug) {
    await octokit.issues.create({
      owner: process.env.GITHUB_ORG,
      repo: process.env.GITHUB_REPO,
      title: `Venue data update for ${venue}`,
      body,
      labels: ['venue data'],
    });
  }
}

/**
 * Serverless function that shortens a provided URL with the modsn.us URL
 * shortener. This cannot be implemented into the main /website as it requires
 * a YOURLS secret.
 */
const handler: VercelApiHandler = async (request, response) => {
  const shortenResponse = await axios.get('https://modsn.us/yourls-api.php', {
    params: {
      action: 'shorturl',
      format: 'json',
      url: request.query.url,
      // Obtain the signature from https://modsn.us/admin/tools.php (internal-only)
      signature: process.env.YOURLS_SIGNATURE,
    },
  });

  response.status(shortenResponse.status).json(shortenResponse.data);
};

export default handler;
