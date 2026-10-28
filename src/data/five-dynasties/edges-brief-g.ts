/**
 * 分片 · 五代十国 关系连线（庚）
 * ------------------------------------------------------------------
 * 只连有两件事可指的边：**同相**（有共事之实）与**构陷**（有仇隙之实）。
 * 「同朝为臣」不算关系——李崧与桑维翰同为后晋宰相，史未载其交恶亦未载其相善，
 * 故此层不给二人连线，只连到石敬瑭这个共同的主君。
 *
 * 两条不连的边。其一是 **冯道与李崧**。二人同为后晋宰相，但《旧五代史》里
 * 找不到一件把两人钉在一起的事，只有「同时在中书」这一层。
 * 按本片已定的纪律（见 edges-brief-e.ts 第一条），同朝不算关系，故不连。
 */
import { rb } from '../_helpers';

const OLD = '《旧五代史》';

export const fiveDynBriefEdgesG = [
  rb('lisong_shijingtang', 'shi_jingtang', 'li_song', 'monarch_subject', '后晋宰相', true, 8,
    '后晋高祖即位，李崧为中书侍郎、同平章事，与桑维翰、冯道等同居相位。',
    [OLD, '卷一百八·汉书十·列传五'], { startYear: 936, endYear: 946 }),

  rb('lisong_liuzhiyuan', 'liu_zhiyuan', 'li_song', 'monarch_subject', '授太子太师', true, 7,
    '后汉高祖入汴，素重李崧，授太子太师；次年崧即为苏逢吉所构陷族诛。',
    [OLD, '卷一百八·汉书十·列传五'], { startYear: 947, endYear: 948 }),

  rb('lisong_sufengji', 'li_song', 'su_fengji', 'political_rival', '构陷族诛', false, 9,
    '苏逢吉与李崧有隙，乾祐元年诬其谋叛，崧与家人数十口同日被诛，时论冤之。',
    [OLD, '卷一百八·汉书十·列传五'], { startYear: 948, endYear: 948 }),

  rb('liuxu_shijingtang', 'shi_jingtang', 'liu_xu', 'monarch_subject', '领史职·监修国史', true, 7,
    '后晋代唐，刘昫仍领史职，以宰相监修国史；开运二年《唐书》二百卷成，领衔进呈。',
    [OLD, '卷八十九·晋书十五·列传四'], { startYear: 936, endYear: 945 }),

  /* 冯道与刘昫也没有连。理由同上面那条：二人都领过史职，但「先后主史馆」
     仍是同署而非交往，与本片「同朝不算关系」的纪律相冲突。
     强连一条只会让「五代文臣」这条道看起来比实际更紧密。 */
];
