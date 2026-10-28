/**
 * 先秦 · 补述层连线（edges-brief-d）
 * ------------------------------------------------------------------
 * 与 persons-brief-d 配套。仍只著录传目（rb），不录原文。
 *
 * 选边的一条原则：**尽量连到片内既有的大国主轴上去**。
 * 这十人分散在郑、卫、陈、蔡四国，若只连「本国兄弟父子」，
 * 图上不过是四条各自三五人的小岛。故本层刻意留了四条跨道边：
 *  - 卫武公 — 周平王：平王命武公为公（卫与周室）
 *  - 卫懿公 — 齐桓公：狄灭卫而后齐桓公封卫于楚丘（卫与齐）
 *  - 陈完 — 齐桓公：齐桓公以为工正，田氏自此立于齐（陈与齐）
 *  - 息妫 — 楚成王：息妫归楚所生之子即熊恽（陈与楚）
 * 四条边把「中原小国」接进周、齐、楚三条主线，本片才不是一堆互不相干的国。
 */
import { rb } from '../_helpers';

const SJ = '《史记》';
const ZZ = '《左传》';

export const preQinBriefEdgesD = [
  /* ------------------------------ 郑国 ------------------------------ */
  rb('yingkaoshu_zhengzhuang', 'zheng_zhuang_gong', 'ying_kao_shu', 'monarch_subject', '献隧见母之策', true, 8,
    '郑庄公誓「不及黄泉，无相见也」而后悔，颍考叔食舍肉以遗母，因献「阙地及泉，隧而相见」之策，庄公从之，遂为母子如初。',
    [ZZ, '隐公元年·郑伯克段于鄢'], { startYear: -722, endYear: -712 }),
  rb('duan_zhengzhuang', 'gong_shu_duan', 'zheng_zhuang_gong', 'kinship_blood', '兄弟相攻·克段于鄢', false, 9,
    '共叔段为郑庄公同母弟，母武姜偏爱之；段缮甲治兵谋袭郑，庄公命子封伐京，京人叛段，段出奔共。',
    [ZZ, '隐公元年·郑伯克段于鄢'], { startYear: -722, endYear: -722 }),

  /* ------------------------------ 卫国 ------------------------------ */
  rb('weiwugong_pingwang', 'zhou_pingwang', 'wei_wu_gong', 'monarch_subject', '平王命为公', true, 8,
    '犬戎杀周幽王，卫武公将兵佐周平戎甚有功；周平王东迁，命武公为公。',
    [SJ, '卷三十七·卫康叔世家'], { startYear: -771, endYear: -758 }),
  rb('zhouxu_shique', 'zhou_xu', 'shi_que', 'political_rival', '弑君而见杀于陈', false, 9,
    '州吁弑卫桓公自立，石碏设计使其与石厚如陈，请陈人执之，使右宰丑杀州吁于濮、獳羊肩杀石厚。',
    [ZZ, '隐公四年·石碏大义灭亲'], { startYear: -719, endYear: -719 }),
  rb('weiyigong_huan', 'qi_huan_gong', 'wei_yi_gong', 'political_ally', '狄灭卫而后桓公存卫', true, 7,
    '狄人伐卫，卫师败绩，懿公死；卫之遗民七百三十人，齐桓公封卫于楚丘，卫得以复存。',
    [ZZ, '闵公二年·狄灭卫'], { startYear: -660, endYear: -658 }),

  /* ------------------------------ 陈、蔡 ------------------------------ */
  rb('chenwan_huan', 'qi_huan_gong', 'chen_wan', 'monarch_subject', '以为工正，田氏立于齐', true, 9,
    '陈完惧祸奔齐，齐桓公以为工正；陈完以陈字为田氏，谥敬仲，田氏代齐之绪自此始。',
    [SJ, '卷四十六·田敬仲完世家'], { startYear: -672, endYear: -672 }),
  rb('xiaji_zhuang', 'xia_ji', 'chu_zhuang_wang', 'political_rival', '楚庄王伐陈而欲纳之', true, 7,
    '夏徵舒弑陈灵公，楚庄王率诸侯伐陈、杀徵舒；庄王欲纳夏姬，申公巫臣谏止。',
    [ZZ, '宣公十一年·楚子入陈'], { startYear: -599, endYear: -598 }),
  rb('caiaihou_xigui', 'cai_ai_hou', 'xi_gui', 'kinship_marriage', '连襟而弗宾', false, 8,
    '蔡哀侯与息侯皆娶于陈，为连襟；息妫归息过蔡，蔡哀侯曰「吾姨也」，止而见之，弗宾，遂启衅端。',
    [ZZ, '庄公十年·楚败蔡师于莘'], { startYear: -684, endYear: -684 }),
  rb('caiaihou_huan', 'cai_ai_hou', 'qi_huan_gong', 'political_ally', '北杏之会', false, 5,
    '齐桓公始霸，会宋、陈、蔡、邾于北杏；蔡哀侯时在位，蔡人预焉。',
    [ZZ, '庄公十三年·会于北杏'], { startYear: -681, endYear: -681 }),
  rb('xigui_chengwang', 'xi_gui', 'chu_cheng_wang', 'kinship_blood', '母子', true, 9,
    '楚文王灭息，以息妫归，生堵敖及成王；成王即熊恽，为息妫所出。息妫终身不言，楚子问之，对曰「吾一妇人而事二夫，纵弗能死，其又奚言」。',
    [ZZ, '庄公十四年·楚子灭息']),
];
