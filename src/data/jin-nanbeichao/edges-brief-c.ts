/**
 * 分片 · 两晋南北朝（己）：第九批 30 人的连线
 * ------------------------------------------------------------------
 * 本片原有 60 条边连 95 人，人均 1.26 条，是八片里最稀疏的一档。这批 30 人补 55 条，
 * 全片人均回到 1.6 上下，且刻意把“南朝—北朝”的对撞点亮出来：
 * 盱眙（臧质—拓跋焘）、钟离（韦睿—昌义之—萧衍）、江陵（萧绎—于谨—庾信）、
 * 玉壁（韦孝宽—高欢）、汾北（斛律光—韦孝宽）、河阴（尔朱荣—胡太后—元子攸）。
 *
 * 四条纪律（承前批，逐条落实）：
 *  ① **同朝为臣不算关系**：王俭与谢朓同仕南齐而未尝往还，一条未加。
 *  ② **并称不等于交往**：颜延之与谢灵运并称“颜谢”，但二人性情相左、史传未载深交，
 *     边名写“并称”而 summary 明言“非必往还”。
 *  ③ **敌对写敌对**：臧质守盱眙、韦孝宽守玉壁，与拓跋焘、高欢一律用 military_adversary，
 *     不因“同为名将”而软化成中性。
 *  ④ **附传不上图**：段韶附段荣传、斛律光附斛律金传，二人的边照样挂本人 id，
 *     但本文所据篇名写明“附子”，不冒充本传。
 */
import { rb } from '../_helpers';

const SS = '《宋书》';
const NQS = '《南齐书》';
const LS = '《梁书》';
const CS = '《陈书》';
const WS = '《魏书》';
const BQS = '《北齐书》';
const ZS = '《周书》';
const NS = '《南史》';
const BS = '《北史》';

export const jinBriefEdgesC = [
  /* ============================ 刘宋：元嘉文坛与元嘉北伐 ============================ */
  rb('nb_c_xie_xuan_lingyun', 'xie_xuan', 'xie_lingyun', 'kinship_blood', '祖孙', true, 9,
    '谢灵运为谢玄之孙。灵运幼便颖悟，玄甚异之，谓亲知曰“我乃生瑍，瑍那得生灵运”——其父谢瑍生而不慧，故祖特钟爱此孙。',
    [SS, '卷六十七·谢灵运传'], { startYear: 385, endYear: 388 }),
  rb('nb_c_lingyun_yilong', 'liu_yilong', 'xie_lingyun', 'monarch_subject', '赏遇而不与政', true, 7,
    '宋文帝征灵运为秘书监，使整理秘阁书、补足阙文，又令撰《晋书》。然唯以文义相接，每侍宴谈赏而已；灵运自谓应参时政，意常不平，遂称疾不朝。',
    [SS, '卷六十七·谢灵运传'], { startYear: 424, endYear: 428 }),
  rb('nb_c_lingyun_yanzhi', 'xie_lingyun', 'yan_yanzhi', 'literary_bosom', '并称“颜谢”', false, 6,
    '二人并为元嘉文坛之冠，时称“颜谢”。然性行相左：灵运恃才傲物、纵游无度，延之激直好酒、屡忤权贵。并称者文名之偶同，非必往还之密。',
    [NS, '卷三十四·颜延之传'], { startYear: 424, endYear: 433 }),
  rb('nb_c_yanzhi_yilong', 'liu_yilong', 'yan_yanzhi', 'monarch_subject', '以文见任', true, 6,
    '颜延之历文帝之世，官至御史中丞、国子祭酒。文帝尝问其诸子才能，延之曰“竣得臣笔，测得臣文，㲋得臣义，跃得臣酒”，其倨如此。',
    [SS, '卷七十三·颜延之传'], { startYear: 424, endYear: 453 }),
  rb('nb_c_yikang_yu', 'liu_yu', 'liu_yikang', 'kinship_blood', '父子', true, 9,
    '刘义康为宋武帝第四子。永初元年封彭城王，武帝崩时年十二，后为顾命诸臣所立之文帝所倚。',
    [SS, '卷六十八·武二王传·彭城王义康'], { startYear: 409, endYear: 422 }),
  rb('nb_c_yikang_yilong', 'liu_yilong', 'liu_yikang', 'kinship_blood', '兄弟，终以猜忌见废', true, 10,
    '义康为文帝之弟。元嘉六年征入朝，共录尚书事，专总朝权十余年，事决于己而后奏闻；元嘉之治，府库充实、内政修举，义康之力居多。然势倾天下，朝士辐凑其门，文帝渐不能平：十七年诛其党刘湛等，出为江州刺史；二十二年坐范晔谋立事废为庶人；二十八年赐死。',
    [SS, '卷六十八·武二王传·彭城王义康'], { startYear: 429, endYear: 451 }),
  rb('nb_c_zangzhi_yilong', 'liu_yilong', 'zang_zhi', 'monarch_subject', '守盱眙，晚节以叛终', true, 7,
    '元嘉二十七年魏军南下，臧质以辅国将军率万人北救彭城，至盱眙而拓跋焘已过淮，遂与太守沈璞共守孤城，卒以功封始兴郡公。孝建元年复与南郡王刘义宣举兵反，兵败走武昌，为人所斩。其人一节一叛，并系于文帝一朝之任遇。',
    [SS, '卷七十四·臧质传'], { startYear: 450, endYear: 454 }),
  rb('nb_c_zangzhi_tao', 'tuo_ba_tao', 'zang_zhi', 'military_adversary', '盱眙攻守', true, 10,
    '拓跋焘围盱眙，遗质书索酒，质封溲便与之。焘怒，筑长围、肉薄攻城，死者与城平；凡三旬不克，军中多疾疫，乃烧攻具退走。',
    [SS, '卷七十四·臧质传'], { startYear: 450, endYear: 451 }),
  rb('nb_c_qingzhi_yilong', 'liu_yilong', 'shen_qingzhi', 'monarch_subject', '谏止北伐', true, 8,
    '元嘉二十七年文帝将大举北伐，庆之谏曰“治国譬如治家，耕当问奴，织当访婢。陛下今欲伐国，而与白面书生辈谋之，事何由济”。帝不听，果败于滑台。三年后太子刘劭弑父自立，庆之复佐孝武帝为前锋讨之，克建康，以功封始兴郡公。',
    [SS, '卷七十七·沈庆之传'], { startYear: 450, endYear: 453 }),

  /* ============================ 南齐：永明之政与永明体 ============================ */
  rb('nb_c_daocheng_ze', 'xiao_daocheng', 'xiao_ze', 'kinship_blood', '父子', true, 9,
    '萧赜为齐高帝长子。宋末从父征战，累官江州刺史；建元元年道成代宋，立为皇太子，建元四年即位。',
    [NQS, '卷三·武帝纪'], { startYear: 440, endYear: 482 }),
  rb('nb_c_wangjian_daocheng', 'xiao_daocheng', 'wang_jian_nq', 'monarch_subject', '佐成禅代', true, 8,
    '王俭为萧道成太尉右长史，与褚渊共劝进。禅代之际，诏策、仪注皆出俭手，齐台建，迁尚书右仆射。',
    [NQS, '卷二十三·王俭传'], { startYear: 477, endYear: 479 }),
  rb('nb_c_wangjian_ze', 'xiao_ze', 'wang_jian_nq', 'monarch_subject', '倚为宰辅', true, 7,
    '永明三年王俭领国子祭酒，罢总明观，于其宅开学士馆，悉以四部书充之。齐武帝深相倚任，朝仪典制多所咨访。',
    [NQS, '卷二十三·王俭传'], { startYear: 483, endYear: 489 }),
  rb('nb_c_xietiao_ze', 'xiao_ze', 'xie_tiao', 'monarch_subject', '永明文士', true, 5,
    '谢朓为竟陵王萧子良西邸文士，与沈约、王融等号“竟陵八友”，永明体即盛于此朝。武帝好文学，东宫、诸王皆招文士。',
    [NQS, '卷四十七·王融谢朓传'], { startYear: 487, endYear: 493 }),
  rb('nb_c_xietiao_shenyue', 'shen_yue', 'xie_tiao', 'literary_bosom', '赏其诗', true, 7,
    '沈约每见朓诗，辄嗟赏不已，尝云“二百年来无此诗也”。二人同倡永明体，讲求四声八病，为近体诗之先声。',
    [NQS, '卷四十七·王融谢朓传'], { startYear: 490, endYear: 499 }),

  /* ============================ 南梁：钟离、侯景与江陵 ============================ */
  rb('nb_c_weirui_yan', 'xiao_yan', 'wei_rui', 'monarch_subject', '倚为方面', true, 8,
    '齐末韦睿为上庸太守，萧衍起兵，睿率郡人伐竹为筏、倍道来赴，衍见之大悦，曰“他日见君之面，今日见君之心”。梁台建，迁豫州刺史。',
    [LS, '卷十二·韦睿传'], { startYear: 501, endYear: 502 }),
  rb('nb_c_weirui_yizhi', 'wei_rui', 'chang_yizhi', 'political_ally', '钟离守援', false, 9,
    '天监五年魏元英围钟离，昌义之以三千人守孤城数月，城坏随补。韦睿自合肥驰救，堰肥水以通舟，与曹景宗连营进逼，一战破魏，义之出城夹击，魏军投淮水死者十余万。',
    [LS, '卷十二·韦睿传'], { startYear: 506, endYear: 506 }),
  rb('nb_c_yizhi_yan', 'xiao_yan', 'chang_yizhi', 'monarch_subject', '守边见任', true, 6,
    '昌义之随萧衍起兵为前锋，梁台建后累迁北徐州刺史，镇钟离。武帝以其宿将，委以淮上之寄。',
    [LS, '卷十八·昌义之传'], { startYear: 502, endYear: 523 }),
  rb('nb_c_gang_yan', 'xiao_yan', 'xiao_gang', 'kinship_blood', '父子', true, 9,
    '萧纲为梁武帝第三子。昭明太子萧统卒后，中大通三年立为皇太子，居东宫十九年，招纳文士，宫体诗风由是而盛。',
    [LS, '卷四·简文帝纪'], { startYear: 503, endYear: 531 }),
  rb('nb_c_gang_tong', 'xiao_tong', 'xiao_gang', 'kinship_blood', '兄弟', true, 7,
    '萧统为武帝长子，萧纲为第三子。统以太子监国、编《文选》；统卒，纲继为太子。二人皆好文，东宫文事相承。',
    [LS, '卷四·简文帝纪'], { startYear: 503, endYear: 531 }),
  rb('nb_c_gang_houjing', 'hou_jing', 'xiao_gang', 'monarch_subject', '立而复弑', true, 10,
    '太清三年台城陷，武帝为其所制，寻崩。侯景立纲为帝，改元大宝，政事一决于景。大宝二年景废之，幽于永福省，以土囊压杀，年四十九。',
    [LS, '卷四·简文帝纪'], { startYear: 549, endYear: 551 }),
  rb('nb_c_yi_yan', 'xiao_yan', 'xiao_yi', 'kinship_blood', '父子', true, 9,
    '萧绎为梁武帝第七子，天监十三年封湘东王，出镇荆州。侯景乱起，绎不先勤王而与诸侄构兵，后遣王僧辩、陈霸先东下平景。',
    [LS, '卷五·元帝纪'], { startYear: 508, endYear: 549 }),
  rb('nb_c_yi_houjing', 'xiao_yi', 'hou_jing', 'political_rival', '平侯景', true, 10,
    '承圣元年，绎遣王僧辩、陈霸先东下讨侯景，景败走，为其下所杀，传首江陵。绎遂即位于江陵，改元承圣。',
    [LS, '卷五·元帝纪'], { startYear: 552, endYear: 552 }),
  rb('nb_c_yi_sengbian', 'xiao_yi', 'wang_sengbian', 'monarch_subject', '东下讨景', true, 8,
    '王僧辩为湘东王萧绎所任，与陈霸先共讨侯景。景平，僧辩以功镇建康。后绎死，僧辩纳北齐所立之萧渊明，为陈霸先所杀。',
    [LS, '卷五·元帝纪'], { startYear: 552, endYear: 555 }),
  rb('nb_c_yi_baxian', 'xiao_yi', 'chen_baxian', 'monarch_subject', '会讨侯景', true, 7,
    '陈霸先自岭南起兵北上，与王僧辩会于湓口，共讨侯景。景平，霸先镇京口，后遂代梁。',
    [LS, '卷五·元帝纪'], { startYear: 552, endYear: 555 }),
  rb('nb_c_yi_yujin', 'yu_jin_nb', 'xiao_yi', 'military_adversary', '江陵之陷', true, 10,
    '承圣三年，西魏遣于谨、宇文护率军攻江陵。城陷，萧绎焚古今图书十四万卷而出降，魏人杀之，尽收其府库。',
    [ZS, '卷十五·于谨传'], { startYear: 554, endYear: 555 }),
  rb('nb_c_yuxin_yi', 'xiao_yi', 'yu_xin', 'monarch_subject', '承制授职', true, 6,
    '台城陷后庾信奔江陵，湘东王承制除为御史中丞；绎即位，转右卫将军，封武康县侯，加散骑常侍。',
    [ZS, '卷四十一·王褒庾信传'], { startYear: 550, endYear: 554 }),
  rb('nb_c_yuxin_gang', 'xiao_gang', 'yu_xin', 'monarch_subject', '东宫学士', true, 7,
    '庾信之父肩吾为梁太子中庶子，掌管记；信年十九为东宫抄撰学士，与徐陵并为抄撰，父子出入禁闼，恩礼莫与比隆。世号“徐庾体”。',
    [ZS, '卷四十一·王褒庾信传'], { startYear: 531, endYear: 548 }),

  /* ============================ 南陈：天嘉、太建与文坛 ============================ */
  rb('nb_c_chenqian_baxian', 'chen_baxian', 'chen_qian', 'kinship_blood', '叔侄', true, 9,
    '陈蒨为陈武帝之侄（始兴昭烈王陈道谭长子）。梁末从霸先起兵，承圣中为吴兴太守，霸先讨王僧辩，蒨预其谋。',
    [CS, '卷三·世祖纪'], { startYear: 522, endYear: 559 }),
  rb('nb_c_chenqian_yong', 'wu_mingche', 'chen_qian', 'monarch_subject', '宿将见任', true, 6,
    '吴明彻自梁末即为陈霸先所纳，陈文帝时累迁镇前将军，为天嘉、天康间宿将。',
    [CS, '卷九·吴明彻传'], { startYear: 559, endYear: 566 }),
  rb('nb_c_chenxu_qian', 'chen_qian', 'chen_xu', 'kinship_blood', '兄弟', true, 9,
    '陈顼为陈文帝之弟，封安成王。天嘉中入朝辅政；伯宗即位后，顼以司徒专权，光大二年废伯宗自立。',
    [CS, '卷五·宣帝纪'], { startYear: 530, endYear: 568 }),
  rb('nb_c_mingche_xu', 'chen_xu', 'wu_mingche', 'monarch_subject', '北伐主帅', true, 9,
    '太建五年，宣帝议北伐，以吴明彻为都督统众十万出秦郡，连下仁州、寿阳等数十城，擒王琳，淮南之地尽复。太建九年败于吕梁，明彻被擒，淮南复失。',
    [CS, '卷九·吴明彻传'], { startYear: 573, endYear: 578 }),
  rb('nb_c_chenxu_shubao', 'chen_xu', 'chen_shubao', 'kinship_blood', '父子', true, 8,
    '陈叔宝为宣帝长子。太建十四年宣帝崩，叔宝即位，即陈后主，祯明三年隋军入建康，陈亡。',
    [CS, '卷五·宣帝纪'], { startYear: 553, endYear: 582 }),
  rb('nb_c_xuling_qian', 'chen_qian', 'xu_ling', 'monarch_subject', '掌诏诰', true, 7,
    '徐陵自北齐南还后历事梁、陈四帝，陈文帝时掌诏诰，朝廷大制作多出其手，官至尚书左仆射。',
    [CS, '卷二十六·徐陵传'], { startYear: 559, endYear: 566 }),
  rb('nb_c_yuxin_xuling', 'yu_xin', 'xu_ling', 'literary_bosom', '并称“徐庾体”', false, 8,
    '二人同为梁东宫抄撰学士，文并绮艳，世号“徐庾体”，后进竞相模范。庾信滞留北方，徐陵终老江南，晚年各有《哀江南》《玉台》之作，而终身不复相见。',
    [ZS, '卷四十一·王褒庾信传'], { startYear: 531, endYear: 554 }),

  /* ============================ 北魏：三长制、迁都与河阴 ============================ */
  rb('nb_c_lichong_hong', 'yuan_hong', 'li_chong', 'monarch_subject', '倚任定制度', true, 9,
    '太和十年李冲建议废宗主督护、立三长，朝议初以为扰，冲力陈其便，遂行；又与定新租调、营建洛阳新都，宗庙宫室百官之仪多出其手。孝文帝深相倚任。',
    [WS, '卷五十三·李孝伯传附子冲'], { startYear: 486, endYear: 498 }),
  rb('nb_c_yuancheng_hong', 'yuan_hong', 'yuan_cheng', 'kinship_blood', '宗室从兄弟', true, 8,
    '元澄为任城王拓跋云之子，与孝文帝同出景穆太子一系。迁都之议，帝独与澄密谋，澄赞其决，帝称为“吾之子房”；奉命还平城宣谕代北旧族，众莫敢违。',
    [WS, '卷十九中·景穆十二王传·任城王附'], { startYear: 493, endYear: 499 }),
  rb('nb_c_hutaihou_rong', 'erzhu_rong', 'hu_taihou', 'military_adversary', '河阴之变', true, 10,
    '武泰元年胡太后鸩杀孝明帝、立幼主，尔朱荣举兵入洛，执太后与幼主，沉之于河，并围朝士于陶渚，纵骑践杀二千余人。',
    [WS, '卷七十四·尔朱荣传'], { startYear: 528, endYear: 528 }),
  rb('nb_c_ziyou_rong', 'erzhu_rong', 'yuan_ziyou', 'political_rival', '立之而复手刃之', true, 10,
    '尔朱荣沉太后幼主而立元子攸，朝政一决于荣。永安三年，子攸伏兵明光殿，乘荣入朝亲手杀之；荣之从子尔朱兆等举兵复仇，执子攸缢于晋阳佛寺。',
    [WS, '卷十·孝庄纪'], { startYear: 528, endYear: 530 }),
  rb('nb_c_rong_gaohuan', 'erzhu_rong', 'gao_huan', 'monarch_subject', '旧部', true, 8,
    '高欢初依尔朱荣，为其亲信都督。荣死，欢起兵讨尔朱氏，尽诛其族，遂据晋阳而制东魏——此边记其始附，非终始相保。',
    [BQS, '卷一·神武帝纪'], { startYear: 528, endYear: 530 }),
  rb('nb_c_xiu_gaohuan', 'gao_huan', 'yuan_xiu', 'monarch_subject', '立之而遥制', true, 9,
    '普泰二年高欢入洛讨尔朱氏，立元子修为帝。欢居晋阳遥制朝政，树置亲党；子修不能堪，欲引关中之兵以图之。',
    [WS, '卷十一·出帝纪'], { startYear: 532, endYear: 534 }),
  rb('nb_c_xiu_yuwentai', 'yuan_xiu', 'yu_wen_tai', 'monarch_subject', '西奔倚之', true, 9,
    '永熙三年子修与高欢决裂，西奔长安依宇文泰。泰迎之，未几以其有异图，鸩杀之，年二十五。北魏自此分为东西二魏。',
    [WS, '卷十一·出帝纪'], { startYear: 534, endYear: 534 }),

  /* ============================ 东魏北齐：文襄之政与北齐三杰 ============================ */
  rb('nb_c_gaocheng_huan', 'gao_huan', 'gao_cheng', 'kinship_blood', '父子', true, 9,
    '高澄为高欢长子。天平三年入辅朝政，机略严明，朝野振肃；武定五年高欢崩，澄秘不发丧，逐侯景于河南。',
    [BQS, '卷三·补帝纪第三·文襄帝'], { startYear: 521, endYear: 549 }),
  rb('nb_c_gaocheng_houjing', 'gao_cheng', 'hou_jing', 'political_rival', '逐景于河南', true, 9,
    '高欢崩，侯景以河南叛，诱执豫州刺史高元成等。高澄遣韩轨、慕容绍宗等讨之，景败，南奔梁。景之反复，实由澄少年嗣事、不为景所惮。',
    [BQS, '卷三·补帝纪第三·文襄帝'], { startYear: 547, endYear: 548 }),
  rb('nb_c_gaocheng_yang', 'gao_cheng', 'gao_yang', 'kinship_blood', '兄弟', true, 7,
    '高洋为高欢次子、高澄之弟。澄遇刺后，洋入讨兰京等，脔割之；寻受禅代魏，是为北齐文宣帝。',
    [BQS, '卷三·补帝纪第三·文襄帝'], { startYear: 549, endYear: 549 }),
  rb('nb_c_duanshao_huan', 'gao_huan', 'duan_shao', 'kinship_blood', '舅甥', true, 8,
    '段韶为段荣之子，其母为高欢之姊（一说娄后所生），故韶以甥舅之亲自幼为欢所爱。兴和四年邙山之战，韶一箭毙贺拔胜前驱，救欢于危。',
    [BQS, '卷十六·段荣传附子韶'], { startYear: 496, endYear: 547 }),
  rb('nb_c_duanshao_changgong', 'duan_shao', 'gao_changgong', 'political_ally', '同御周师', false, 8,
    '武平二年周师来寇，段韶与右丞相斛律光、太尉兰陵王高长恭同往捍御。攻柏谷城，诸将莫肯先，韶独鸣鼓急攻，城溃；又围定阳，谓长恭曰“贼若突围，必从东南”，果如其策。',
    [BQS, '卷十六·段荣传附子韶'], { startYear: 571, endYear: 571 }),
  rb('nb_c_hulv_changgong', 'hulv_guang', 'gao_changgong', 'political_ally', '北齐三杰', false, 8,
    '斛律光、段韶、高长恭并为北齐名将，时号“三杰”。河清三年邙山之战，长恭率五百骑解金墉之围，光与韶亦预其役。',
    [BQS, '卷十七·斛律金传附子光'], { startYear: 564, endYear: 571 }),
  rb('nb_c_hulv_cheng', 'gao_cheng', 'hulv_guang', 'monarch_subject', '宿将世家', true, 6,
    '斛律氏世为高氏将门：斛律金佐高欢起兵，其子光自高澄时即为都督，历文襄、文宣、孝昭、武成、后主五朝。',
    [BQS, '卷十七·斛律金传附子光'], { startYear: 540, endYear: 549 }),
  rb('nb_c_hulv_xiaokuan', 'hulv_guang', 'wei_xiaokuan', 'military_adversary', '汾北争城', true, 10,
    '武平元年、二年，斛律光与北周韦孝宽争汾北，筑华谷、龙门等城，屡战皆捷。孝宽不能胜，乃作童谣“百升飞上天，明月照长安”以间之，光遂见杀。',
    [BQS, '卷十七·斛律金传附子光'], { startYear: 570, endYear: 572 }),

  /* ============================ 西魏北周：八柱国与玉壁 ============================ */
  rb('nb_c_hu_tai', 'yu_wen_tai', 'yuwen_hu', 'kinship_blood', '叔侄', true, 9,
    '宇文护为宇文泰之兄邵惠公宇文颢之少子。幼方正有志度，泰奇之，尝叹曰“此儿志度类我”。泰崩，诸子并幼，护受顾命，遂代魏建周。',
    [ZS, '卷十一·晋荡公护传'], { startYear: 515, endYear: 556 }),
  rb('nb_c_hu_yong', 'yuwen_hu', 'yu_wen_yong', 'political_rival', '执政权臣与韬晦之君', true, 10,
    '宇文护先后废孝闵帝、鸩明帝，立武帝宇文邕，自西魏恭帝元年至建德元年执朝政十五年。武帝深自韬晦，建德元年诱护入含仁殿，自后以玉珽击之，诛其党羽。',
    [ZS, '卷十一·晋荡公护传'], { startYear: 560, endYear: 572 }),
  rb('nb_c_yujin_tai', 'yu_wen_tai', 'yu_jin_nb', 'monarch_subject', '八柱国', true, 8,
    '于谨为西魏八柱国之一，宇文泰倚为心膂。大统十二年邙山之战与泰俱败，坐免官，寻复位；后与宇文护共攻江陵。',
    [ZS, '卷十五·于谨传'], { startYear: 535, endYear: 556 }),
  rb('nb_c_sizheng_tai', 'yu_wen_tai', 'wang_sizheng', 'monarch_subject', '西迁从任', true, 7,
    '王思政少有大节，从孝武帝西迁，遂为宇文泰所任。大统四年请筑玉壁以扼东魏，泰从之，玉壁遂为西魏河东锁钥。',
    [ZS, '卷十八·王思政传'], { startYear: 534, endYear: 548 }),
  rb('nb_c_xiaokuan_tai', 'yu_wen_tai', 'wei_xiaokuan', 'monarch_subject', '镇玉壁', true, 8,
    '韦孝宽自弱冠即为宇文泰所拔，大统八年移镇玉壁。泰崩后，孝宽历事周室，官至柱国大将军。',
    [ZS, '卷三十一·韦孝宽传'], { startYear: 534, endYear: 556 }),
  rb('nb_c_xiaokuan_huan', 'gao_huan', 'wei_xiaokuan', 'military_adversary', '玉壁攻守', true, 10,
    '大统十二年高欢倾山东之众攻玉壁，连营数十里，起土山、凿地道、造攻车；孝宽随方御之，城中无水则凿井，凡六旬，魏军死者七万余人，欢智力皆困，解围去，未几发病而卒。',
    [ZS, '卷三十一·韦孝宽传'], { startYear: 546, endYear: 547 }),
  rb('nb_c_sizheng_cheng', 'wang_sizheng', 'gao_cheng', 'military_adversary', '颍川攻守', true, 9,
    '大统十四年侯景叛，王思政率众入据颍川。东魏高岳、慕容绍宗等围之，堰洧水灌城，经年不下；慕容绍宗溺死，高澄亲征，城遂陷，思政被擒。澄以其忠，礼遇甚厚。',
    [ZS, '卷十八·王思政传'], { startYear: 548, endYear: 549 }),
];
