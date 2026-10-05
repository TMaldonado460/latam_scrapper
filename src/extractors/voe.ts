import type { Ctx } from '../ctx.js';
import type { Meta } from '../types.js';
import { fetchText, NotFoundError } from '../fetcher.js';
import { b64Decode } from '../utils.js';
import { Extracted, Extractor, mediaFlowUrl } from './extractor.js';

const VOE_EXTRA_DOMAINS = [
  '19turanosephantasia.com',
  '20demidistance9elongations.com',
  '30sensualizeexpression.com',
  '321naturelikefurfuroid.com',
  '35volitantplimsoles5.com',
  '449unceremoniousnasoseptal.com',
  '745mingiestblissfully.com',
  'adrianmissionminute.com',
  'alleneconomicmatter.com',
  'antecoxalbobbing1010.com',
  'apinchcaseation.com',
  'audaciousdefaulthouse.com',
  'availedsmallest.com',
  'bigclatterhomesguideservice.com',
  'boonlessbestselling244.com',
  'bradleyviewdoctor.com',
  'brittneystandardwestern.com',
  'brucevotewithin.com',
  'christopheruntilpoint.com',
  'chromotypic.com',
  'chuckle-tube.com',
  'cindyeyefinal.com',
  'counterclockwisejacky.com',
  'crownmakermacaronicism.com',
  'crystaltreatmenteast.com',
  'cyamidpulverulence530.com',
  'diananatureforeign.com',
  'donaldlineelse.com',
  'edwardarriveoften.com',
  'erikcoldperson.com',
  'figeterpiazine.com',
  'fittingcentermondaysunday.com',
  'fraudclatterflyingcar.com',
  'gamoneinterrupted.com',
  'generatesnitrosate.com',
  'goofy-banana.com',
  'graceaddresscommunity.com',
  'greaseball6eventual20.com',
  'guidon40hyporadius9.com',
  'heatherdiscussionwhen.com',
  'housecardsummerbutton.com',
  'jamessoundcost.com',
  'jamiesamewalk.com',
  'jasminetesttry.com',
  'jayservicestuff.com',
  'jennifercertaindevelopment.com',
  'jilliandescribecompany.com',
  'johnalwayssame.com',
  'jonathansociallike.com',
  'josephseveralconcern.com',
  'kathleenmemberhistory.com',
  'kellywhatcould.com',
  'kennethofficialitem.com',
  'kristiesoundsimply.com',
  'lancewhosedifficult.com',
  'launchreliantcleaverriver.com',
  'lauradaydo.com',
  'lisatrialidea.com',
  'loriwithinfamily.com',
  'lukecomparetwo.com',
  'lukesitturn.com',
  'mariatheserepublican.com',
  'matriculant401merited.com',
  'maxfinishseveral.com',
  'metagnathtuggers.com',
  'michaelapplysome.com',
  'mikaylaarealike.com',
  'nathanfromsubject.com',
  'nectareousoverelate.com',
  'nonesnanking.com',
  'paulkitchendark.com',
  'realfinanceblogcenter.com',
  'rebeccaneverbase.com',
  'reputationsheriffkennethsand.com',
  'richardsignfish.com',
  'roberteachfinal.com',
  'robertordercharacter.com',
  'robertplacespace.com',
  'sandratableother.com',
  'sandrataxeight.com',
  'scatch176duplicities.com',
  'sethniceletter.com',
  'shannonpersonalcost.com',
  'simpulumlamerop.com',
  'stevenimaginelittle.com',
  'strawberriesporail.com',
  'telyn610zoanthropy.com',
  'timberwoodanotia.com',
  'toddpartneranimal.com',
  'toxitabellaeatrebates306.com',
  'uptodatefinishconferenceroom.com',
  'valeronevijao.com',
  'walterprettytheir.com',
  'wolfdyslectic.com',
  'yodelswartlike.com',
];

function voeDecode(ct: string, lutsRaw: string): Record<string, string> {
  const lut: string[] = lutsRaw
    .slice(2, -2)
    .split("','")
    .map((i) => i.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  let txt = '';
  for (const ch of ct) {
    let x = ch.charCodeAt(0);
    if (x > 64 && x < 91) x = ((x - 52) % 26) + 65;
    else if (x > 96 && x < 123) x = ((x - 84) % 26) + 97;
    txt += String.fromCharCode(x);
  }
  for (const l of lut) {
    txt = txt.replace(new RegExp(l, 'g'), '');
  }
  const first = b64Decode(txt);
  const second = first
    .split('')
    .map((c) => String.fromCharCode(c.charCodeAt(0) - 3))
    .join('');
  const third = b64Decode(second.split('').reverse().join(''));
  return JSON.parse(third) as Record<string, string>;
}

export class Voe extends Extractor {
  public readonly id = 'voe';
  public readonly label = 'VOE';

  public supports(url: URL): boolean {
    return (
      url.host.includes('voe') ||
      url.host === 'smoki.cc' ||
      VOE_EXTRA_DOMAINS.includes(url.host)
    );
  }

  public async extract(url: URL, meta: Meta, ctx: Ctx): Promise<Extracted[]> {
    const headers = { Referer: meta.referer ?? url.origin };

    let webUrl = url;
    if (!webUrl.pathname.includes('/e/')) {
      webUrl = new URL(`/e${webUrl.pathname}`, webUrl.origin);
    }

    let html = (await fetchText(webUrl, { headers })).text;

    while (html.includes('const currentUrl')) {
      const r = html.match(/window\.location\.href\s*=\s*'([^']+)/);
      if (!r) break;
      webUrl = new URL(r[1], webUrl);
      html = (await fetchText(webUrl, { headers })).text;
    }

    if (/An error occurred during encoding/i.test(html)) {
      throw new NotFoundError('VOE: encoding error');
    }

    const heightFromPage = html.match(/<b>(\d{3,})p<\/b>/)?.[1];
    const metaWithHeight = {
      ...meta,
      ...(heightFromPage && { height: parseInt(heightFromPage, 10) }),
    };

    // Modern obfuscated variant
    const r = html.match(/json">\["([^"]+)"]<\/script>\s*<script\s*src="([^"]+)/);
    if (r) {
      const scriptUrl = new URL(r[2], webUrl);
      const scriptHtml = (await fetchText(scriptUrl, { headers })).text;
      const repl = scriptHtml.match(/(\[(?:'\W{2}'[,\]]){1,9})/);
      if (repl) {
        const decoded = voeDecode(r[1], repl[1]);
        const candidates = ['file', 'source', 'direct_access_url']
          .filter((k) => decoded[k])
          .map((k) => decoded[k]);
        if (candidates.length) {
          candidates.sort((a, b) => {
            const da = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
            const db = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
            return db - da;
          });
          const picked = candidates[0];
          return [this.buildResult(new URL(picked), metaWithHeight, ctx)];
        }
      }
    }

    // Legacy variants
    const patterns = [
      /mp4["']:\s*["']([^"']+)["'],\s*["']video_height["']:\s*(\d+)/,
      /hls['"]:\s*['"]([^'"]+)/,
      /hls["']:\s*["']([^"']+)["'],\s*["']video_height["']:\s*(\d+)/,
    ];
    for (const pattern of patterns) {
      const m = html.match(pattern);
      if (m && m[1]) {
        const streamUrl = new URL(m[1].replace(/\\\//g, '/'));
        return [this.buildResult(streamUrl, metaWithHeight, ctx)];
      }
    }

    throw new NotFoundError('VOE: no video found');
  }

  private buildResult(streamUrl: URL, meta: Meta, ctx: Ctx): Extracted {
    const format = streamUrl.href.includes('m3u8') ? 'hls' : 'mp4';
    // VOE streams want the referer; wrap through MediaFlow when configured.
    const wrapped = mediaFlowUrl(streamUrl, format === 'hls' ? 'stream' : 'redirect', ctx, {
      Referer: meta.referer ?? streamUrl.origin,
    });
    return {
      url: wrapped ?? streamUrl,
      format: wrapped ? 'hls' : format,
      meta,
      label: 'VOE',
      needsReferer: !wrapped,
    };
  }
}
