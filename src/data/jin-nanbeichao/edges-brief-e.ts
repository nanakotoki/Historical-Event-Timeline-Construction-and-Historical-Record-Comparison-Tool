/**
 * 两晋南北朝 · 补述层连线（edges-brief-e）
 * ------------------------------------------------------------------
 * 与 persons-brief-e 配套。仍只著录传目（rb），不录原文。
 *
 * 两条取舍：
 *  ① **跨泳道的边优先**。庾冰—郗鉴（辟为长史）、郗愔—王羲之（姻亲）、
 *     郗超—桓温（谋主）、赵贵—宇文泰（首议迎立）四条，把三条单人道接回主图；
 *     只连族内兄弟父子，图上仍是一串孤岛。
 *  ② **宇文泰—独孤信一条已存，不再重复**；宇文护与独孤信之间另立一条
 *     （逼令自尽），与「宇文泰—独孤信」（委以陇右）是两件事，不可合并。
 */
import { rb } from '../_helpers';

const JS = '《晋书》';
const ZS = '《周书》';

export const jinBriefEdgesE = [
  /* ------------------------------ 颍川庾氏 ------------------------------ */
  rb('yuliang_bing', 'yu_liang', 'yu_bing', 'kinship_blood', '兄弟', false, 8,
    '庾冰为庾亮之弟，亮以名德流训、冰以雅素垂风，亮常以为「庾氏之宝」；亮卒后冰继其位辅政。',
    [JS, '卷七十三·列传第四十三']),
  rb('yuliang_yi', 'yu_liang', 'yu_yi', 'kinship_blood', '兄弟', false, 8,
    '庾翼为庾亮之弟；苏峻之乱时亮使翼白衣领数百人备石头，亮卒后翼代镇武昌，尽领其众。',
    [JS, '卷七十三·列传第四十三'], { startYear: 328, endYear: 340 }),
  rb('yubing_yi', 'yu_bing', 'yu_yi', 'kinship_blood', '兄弟分居中枢与上流', false, 9,
    '庾冰在中书监、扬州刺史任上辅政，庾翼以荆州刺史镇江陵、武昌；兄弟一居中枢、一据上流，庾氏之政赖此相维。',
    [JS, '卷七十三·列传第四十三'], { startYear: 340, endYear: 344 }),
  rb('yubing_wangdao', 'wang_dao', 'yu_bing', 'monarch_subject', '辟为司徒右长史，继其辅政', true, 7,
    '王导请庾冰为司徒右长史；王导卒后人情恇然，庾冰入为中书监、扬州刺史，朝野注心，咸曰贤相。其政颇任威刑，与王导之宽惠为两途。',
    [JS, '卷七十三·列传第四十三'], { startYear: 330, endYear: 339 }),
  rb('yubing_xijian', 'xi_jian', 'yu_bing', 'political_ally', '辟为长史而不就', true, 5,
    '司空郗鉴请庾冰为长史，庾冰不就；二人同为苏峻之乱后中枢之望，而出处各别。',
    [JS, '卷七十三·列传第四十三'], { startYear: 330, endYear: 339 }),
  rb('yuyi_huanwen', 'huan_wen', 'yu_yi', 'political_rival', '废其子而收其众', true, 7,
    '庾翼卒，其子庾方之、庾爰之领其部众；桓温代之，遂废方之、爰之，庾氏在上流之势自此尽归于桓氏。',
    [JS, '卷七十三·列传第四十三'], { startYear: 345, endYear: 346 }),

  /* ------------------------------ 高平郗氏 ------------------------------ */
  rb('xijian_yin', 'xi_jian', 'xi_yin', 'kinship_blood', '父子', true, 8,
    '郗愔为郗鉴之子，服阕袭爵南昌公；郗鉴永嘉丧乱中携兄子郗迈、外甥周翼就食，吐饭哺二儿，皆得存活。',
    [JS, '卷六十七·列传第三十七']),
  rb('xiyin_chao', 'xi_yin', 'xi_chao', 'kinship_blood', '父子而所奉不同', true, 8,
    '郗超为郗愔之子；郗愔事天师道而郗超奉佛，愔好聚敛积钱数千万，超性好施，一日中散与亲故都尽。',
    [JS, '卷六十七·列传第三十七']),
  rb('xichao_huanwen', 'huan_wen', 'xi_chao', 'mentor_disciple', '谋主·入幕之宾', true, 9,
    '桓温辟郗超为参军，温英气高迈、罕有所推，与超语常谓不可测，遂倾意礼待；废海西公、立简文帝之谋，实出于超。',
    [JS, '卷六十七·列传第三十七'], { startYear: 356, endYear: 373 }),
  rb('xiyin_wangxizhi', 'xi_yin', 'wang_xizhi', 'kinship_marriage', '姻亲（姊夫）', false, 7,
    '王羲之娶郗鉴之女，故为郗愔之姊夫；二人与高士许询并有迈世之风，俱栖心绝谷、修黄老之术。',
    [JS, '卷六十七·列传第三十七'], { startYear: 340, endYear: 384 }),

  /* ------------------------------ 关陇集团 ------------------------------
   * 宇文泰—独孤信一条已存，此处不重复；宇文护与独孤信另立一条，见下。 */
  rb('zhaogui_tai', 'zhao_gui', 'yu_wen_tai', 'monarch_subject', '首议迎立', true, 9,
    '贺拔岳为侯莫陈悦所害，将吏奔散，赵贵收岳尸、纠合其众奔平凉，首议迎宇文泰；泰至，以贵为大都督、领府司马。',
    [ZS, '卷十六·列传第八'], { startYear: 534, endYear: 534 }),
  rb('zhaogui_duguxin', 'du_gu_xin', 'zhao_gui', 'political_ally', '同谋诛宇文护', false, 9,
    '赵贵与独孤信皆与宇文泰等夷，及宇文护摄政，二人谋杀护；及期，贵欲发而信止之，寻为开府宇文盛所告。',
    [ZS, '卷十六·列传第八'], { startYear: 557, endYear: 557 }),
  rb('houmo_tai', 'hou_mo_chen_chong', 'yu_wen_tai', 'monarch_subject', '八柱国同列', true, 7,
    '侯莫陈崇从贺拔岳入关，岳死后随众归宇文泰，为西魏八柱国之一，与宇文泰同列。',
    [ZS, '卷十六·列传第八'], { startYear: 534, endYear: 556 }),
  rb('yuwenhu_zhaogui', 'yuwen_hu', 'zhao_gui', 'political_rival', '诛之', true, 9,
    '赵贵谋诛宇文护，事泄，为护所诛；独孤信以同谋坐免，未几亦为护所逼。',
    [ZS, '卷十六·列传第八'], { startYear: 557, endYear: 557 }),
  rb('yuwenhu_duguxin', 'yuwen_hu', 'du_gu_xin', 'political_rival', '逼令自尽', true, 9,
    '赵贵诛后，独孤信以同谋坐免；宇文护以其名望素重，不欲显其罪，逼令自尽于家，时年五十五。',
    [ZS, '卷十六·列传第八'], { startYear: 557, endYear: 557 }),
  rb('yuwenhu_houmo', 'yuwen_hu', 'hou_mo_chen_chong', 'political_rival', '以言事见逼', true, 8,
    '侯莫陈崇以言语涉宇文护，为护所逼，自杀；与赵贵、独孤信之死同为宇文护摄政初年之清洗。',
    [ZS, '卷十六·列传第八'], { startYear: 557, endYear: 557 }),
];
