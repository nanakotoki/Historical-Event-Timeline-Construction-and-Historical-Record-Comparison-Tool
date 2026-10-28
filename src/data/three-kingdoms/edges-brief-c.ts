/**
 * 三国 · 补述层连线（edges-brief-c）
 * ------------------------------------------------------------------
 * 与 persons-brief-c 配套，每人至少一条边——孤立节点等于不存在。
 * 只著录传目（rb），不录原文。
 *
 * 三条设计原则：
 *  ① **同一对人物只留一条边**，若一段关系分两个阶段（如「同叛」而后「相杀」），
 *     合入同一条 summary 与 temporalPhases，不另立第二条。
 *  ② **张衡与张修之间不连边**。二者可能是同一人（裴松之疑为传写之误），
 *     连边即成自环。两边的边分别落在「张鲁—张衡（父子）」与「张鲁—张修（袭杀）」。
 *  ③ **跨泳道的边优先留**。刘虞—袁绍（拥立之议）、张燕—公孙瓒（黑山救易京）、
 *     士燮—雍闿（诱导附吴）三事，把本片十四条孤立泳道接回主图，
 *     这比在泳道内部多连一条「同族」有价值得多。
 */
import { rb } from '../_helpers';

const SGZ = '《三国志》';
const HHS = '《后汉书》';

export const threeKingdomsBriefEdgesC = [
  /* ------------------------------ 南中三叛 ------------------------------ */
  rb('yongkai_zhuge', 'zhuge_liang', 'yong_kai', 'military_adversary', '南征被讨', true, 8,
    '刘备卒后南中诸郡并叛，诸葛亮以新遭大丧未便加兵，建兴三年春率众南征，其秋悉平。',
    [SGZ, '卷三十五·蜀书·诸葛亮传第五'], { startYear: 225, endYear: 225 }),
  rb('yongkai_gaoding', 'yong_kai', 'gao_ding', 'political_ally', '同叛而见杀', false, 8,
    '雍闿据益州、高定据越巂，同时并叛，遥相应和；诸葛亮南征军未至，雍闿已为高定部曲所杀。',
    [SGZ, '卷四十三·蜀书·黄李吕马王张传第十三（吕凯传）'], { startYear: 223, endYear: 225 }),
  rb('zhubao_yongkai', 'zhu_bao', 'yong_kai', 'political_ally', '以郡叛应', true, 7,
    '朱褒杀从事常房，遂以牂牁之郡叛，应雍闿；南中三郡之叛自此连成一片。',
    [SGZ, '卷三十三·蜀书·后主传第三（裴注引《魏氏春秋》）'], { startYear: 223, endYear: 223 }),
  rb('menghuo_yongkai', 'yong_kai', 'meng_huo', 'political_ally', '使说夷叟', true, 7,
    '益州夷不复从雍闿，雍闿使建宁孟获说夷叟，以「官欲得乌狗三百头、螨脑三斗」相欺，夷以为然，皆从之。',
    ['《华阳国志》', '卷四·南中志'], { startYear: 223, endYear: 225 }),
  rb('gaoding_zhuge', 'zhuge_liang', 'gao_ding', 'military_adversary', '南征先由越巂', true, 7,
    '诸葛亮南征先由越巂，高定据郡称王相拒；李恢别道向建宁，两军声势相连，南土遂平。',
    [SGZ, '卷四十三·蜀书·黄李吕马王张传第十三（李恢传）'], { startYear: 225, endYear: 225 }),
  rb('yongkai_lihui', 'li_hui', 'yong_kai', 'military_adversary', '案道向建宁', true, 7,
    '诸葛亮由越巂、李恢案道向建宁，诸县大相纠合围恢军于昆明；李恢绐以粮尽欲还，因懈其围，出击大破之。',
    [SGZ, '卷四十三·蜀书·黄李吕马王张传第十三'], { startYear: 225, endYear: 225 }),
  rb('yongkai_lvkai', 'yong_kai', 'lv_kai', 'political_rival', '闭境拒之', false, 8,
    '雍闿降吴、遥署永昌太守，而永昌道路壅塞、与蜀隔绝；吕凯与府丞王伉帅厉吏民，闭境拒闿，永昌独全。',
    [SGZ, '卷四十三·蜀书·黄李吕马王张传第十三'], { startYear: 223, endYear: 225 }),
  rb('yongkai_zhangyi', 'yong_kai', 'zhang_yi_sg', 'political_rival', '缚送于吴', true, 8,
    '张裔为益州太守径往至郡，雍闿趦趄不宾，假鬼教曰「张府君如瓠壶，外虽泽而内实粗，不足杀，令缚与吴」，遂送裔于孙权。',
    [SGZ, '卷四十一·蜀书·霍王向张杨费传第十一'], { startYear: 223, endYear: 223 }),
  rb('zhubao_mazhong', 'ma_zhong', 'zhu_bao', 'military_adversary', '为牂牁太守', true, 6,
    '诸葛亮以马忠为牂牁太守，郡丞朱褒反；叛乱之后，马忠抚育恤理，甚有威惠。',
    [SGZ, '卷四十三·蜀书·黄李吕马王张传第十三（马忠传）'], { startYear: 225, endYear: 225 }),

  /* ------------------------------ 范阳卢氏 ------------------------------ */
  rb('luzhi_luyu', 'lu_zhi', 'lu_yu_sg', 'kinship_blood', '父子', true, 8,
    '卢毓为卢植之子，涿郡涿人；《三国志》卢毓自有传，卢植事则附见《后汉书》。',
    [SGZ, '卷二十二·魏书·桓二陈徐卫卢传第二十二']),
  rb('luyu_caopi', 'cao_pi', 'lu_yu_sg', 'monarch_subject', '署为门下贼曹', true, 5,
    '曹丕为五官将时，召卢毓署门下贼曹；后卢毓历吏部尚书、司空，为魏室选官之重。',
    [SGZ, '卷二十二·魏书·桓二陈徐卫卢传第二十二'], { startYear: 211, endYear: 257 }),

  /* ------------------------------ 南阳何氏 ------------------------------ */
  rb('hejin_hemiao', 'he_jin', 'he_miao', 'kinship_blood', '异父异母兄弟', false, 8,
    '何苗本朱氏子，随母改嫁何真而冒姓何，故与何进为异父异母兄弟；何进谋诛宦官，何苗受赂阻之，进死后为进部将吴匡所杀。',
    [HHS, '卷六十九·窦何列传第五十九'], { startYear: 180, endYear: 189 }),
  rb('hejin_taihou', 'he_jin', 'he_taihou', 'kinship_blood', '兄妹', false, 9,
    '何太后为何进之妹，同出南阳宛；何进以外戚为大将军，太后临朝，兄妹共持汉末之政。',
    [HHS, '卷十下·皇后纪第十下'], { startYear: 180, endYear: 189 }),
  rb('hemiao_taihou', 'he_miao', 'he_taihou', 'kinship_blood', '同母兄妹', false, 8,
    '何苗与何太后同母，太后之立，何氏一门皆贵；何苗以车骑将军封济阳侯，为太后外援。',
    [HHS, '卷六十九·窦何列传第五十九']),
  rb('taihou_dongzhuo', 'dong_zhuo', 'he_taihou', 'political_rival', '废迁而鸩之', true, 9,
    '董卓入京，废少帝为弘农王，以「逆妇姑之礼」迁何太后于永安宫，寻以鸩酒毒杀。',
    [HHS, '卷十下·皇后纪第十下'], { startYear: 189, endYear: 189 }),
  rb('taihou_liuxie', 'he_taihou', 'liu_xie', 'kinship_blood', '非生母而废立系之', false, 7,
    '刘协为灵帝次子，生母王美人为何太后所鸩；董卓废少帝而立协，何太后旋被鸩杀，故二人之命运同系于废立。',
    [HHS, '卷十下·皇后纪第十下'], { startYear: 181, endYear: 189 }),

  /* ------------------------------ 幽州势力 ------------------------------ */
  rb('liuyu_gongsunzan', 'liu_yu_yz', 'gong_sun_zan', 'political_rival', '争幽州而相攻', false, 9,
    '刘虞为幽州牧，公孙瓒受其节度而纵兵侵扰百姓，二人交章相劾；初平四年刘虞自率十万人攻瓒，兵败被执，为瓒诬以谋称尊号而斩于蓟市。',
    [HHS, '卷七十三·刘虞公孙瓒陶谦列传第六十三'], { startYear: 191, endYear: 193 }),
  rb('guanjing_gongsunzan', 'gong_sun_zan', 'guan_jing', 'monarch_subject', '长史', true, 7,
    '关靖为公孙瓒所署长史，袁绍围易京时谏瓒勿自出；瓒败，关靖策马赴绍军而死。',
    [HHS, '卷七十三·刘虞公孙瓒陶谦列传第六十三'], { startYear: 198, endYear: 199 }),
  rb('gongsunxu_gongsunzan', 'gong_sun_zan', 'gong_sun_xu', 'kinship_blood', '父子', true, 8,
    '公孙续为公孙瓒之子，易京被围时奉父命请救于黑山诸帅，与张燕率兵十万来救，未至而瓒已败死。',
    [HHS, '卷七十三·刘虞公孙瓒陶谦列传第六十三'], { startYear: 198, endYear: 199 }),
  rb('liuyu_yuanshao', 'yuan_shao', 'liu_yu_yz', 'political_ally', '议立为帝而见拒', true, 8,
    '袁绍与韩馥等以朝廷幼冲、逼于董卓，欲立刘虞为帝；刘虞厉色叱之，固拒不受，事遂寝。',
    [HHS, '卷七十三·刘虞公孙瓒陶谦列传第六十三'], { startYear: 191, endYear: 191 }),
  rb('liubei_gongsunzan', 'liu_bei', 'gong_sun_zan', 'political_ally', '同门而依之', false, 7,
    '刘备与公孙瓒同师事卢植，相友善；刘备为高唐令所败，往依公孙瓒，瓒表为别部司马。',
    [SGZ, '卷三十二·蜀书·先主传第二'], { startYear: 189, endYear: 193 }),
  rb('gongsunxu_zhangyan', 'zhang_yan', 'gong_sun_xu', 'political_ally', '率兵十万救易京', false, 7,
    '建安四年春，黑山贼帅张燕与公孙续率兵十万，三道来救易京；未及至而公孙瓒已败。',
    [HHS, '卷七十三·刘虞公孙瓒陶谦列传第六十三'], { startYear: 199, endYear: 199 }),

  /* ------------------------------ 辽东公孙氏 ------------------------------ */
  rb('gongsundu_kang', 'gong_sun_du', 'gong_sun_kang', 'kinship_blood', '父子', true, 8,
    '公孙康为公孙度之子，度卒而康继据辽东；康卒，子晃、渊皆幼，众立其弟恭。',
    [SGZ, '卷八·魏书·二公孙陶四张传第八']),
  rb('gongsunkang_yuan', 'gong_sun_kang', 'gong_sun_yuan', 'kinship_blood', '父子', true, 8,
    '公孙渊为公孙康之子，长而夺叔父公孙恭之位；后自称燕王，改元绍汉，为司马懿所灭。',
    [SGZ, '卷八·魏书·二公孙陶四张传第八'], { startYear: 228, endYear: 238 }),
  rb('gongsunyuan_simayi', 'si_ma_yi', 'gong_sun_yuan', 'military_adversary', '襄平之围', true, 9,
    '景初二年司马懿率军四万讨辽东，会霖雨三十余日，平地水数尺；雨止而攻，城破，公孙渊突围被斩。',
    [SGZ, '卷八·魏书·二公孙陶四张传第八'], { startYear: 238, endYear: 238 }),
  rb('gongsunyuan_sunquan', 'sun_quan', 'gong_sun_yuan', 'political_ally', '南通孙权', true, 6,
    '公孙渊遣使南通孙权，权大悦，遣张弥、许晏等浮海立渊为燕王；渊旋斩吴使以自解于魏。',
    [SGZ, '卷八·魏书·二公孙陶四张传第八'], { startYear: 233, endYear: 233 }),

  /* ------------------------------ 交州士氏 ------------------------------ */
  rb('shixie_shiyi', 'shi_xie', 'shi_yi_jz', 'kinship_blood', '兄弟', false, 8,
    '士壹为士燮之弟，初为郡督邮；朱符死后，士燮表壹领合浦太守，与弟䵋、武分领三郡。',
    [SGZ, '卷四十九·吴书·刘繇太史慈士燮传第四']),
  rb('shixie_shiwu', 'shi_xie', 'shi_wu', 'kinship_blood', '兄弟', false, 7,
    '士武为士燮之弟，领南海太守；《士燮传》记「武先病没」，未及见士徽之败。',
    [SGZ, '卷四十九·吴书·刘繇太史慈士燮传第四']),
  rb('shixie_shihui', 'shi_xie', 'shi_hui', 'kinship_blood', '父子', true, 9,
    '士徽为士燮之子；士燮在郡四十余岁、年九十而卒，士徽自署交阯太守，发宗兵拒吴，终至覆族。',
    [SGZ, '卷四十九·吴书·刘繇太史慈士燮传第四'], { startYear: 226, endYear: 226 }),
  rb('shiyi_shihui', 'shi_yi_jz', 'shi_hui', 'kinship_blood', '叔侄同难', false, 7,
    '士徽发宗兵拒戴良，事败伏诛；士壹、士䵋后亦以罪诛，士氏一门由是衰绝。',
    [SGZ, '卷四十九·吴书·刘繇太史慈士燮传第四'], { startYear: 226, endYear: 227 }),
  rb('shihui_lvdai', 'lv_dai', 'shi_hui', 'military_adversary', '诱降而斩之', true, 9,
    '吕岱自广州将兵昼夜驰入，过合浦，遣人说士徽以赦罪；徽率兄弟六人肉袒出降，岱尽斩之，传首武昌。',
    [SGZ, '卷六十·吴书·贺全吕周钟离传第十五'], { startYear: 226, endYear: 226 }),
  rb('shixie_yongkai', 'shi_xie', 'yong_kai', 'political_ally', '诱导遥附东吴', true, 7,
    '士燮诱导益州豪姓雍闿等率郡人民遥东附，孙权嘉之，迁燮卫将军、封龙编侯；雍闿遂缚张裔送吴。',
    [SGZ, '卷四十九·吴书·刘繇太史慈士燮传第四'], { startYear: 223, endYear: 223 }),

  /* ------------------------------ 河东毌丘氏 ------------------------------ */
  rb('guanqiujian_dian', 'guan_qiu_jian', 'guan_qiu_dian', 'kinship_blood', '父子', true, 9,
    '毌丘甸为毌丘俭长子，官治书侍御史；以「国倾覆而晏然自守，将受四海之责」促父起兵，事败夷俭三族。',
    [SGZ, '卷二十八·魏书·王毌丘诸葛邓钟传第二十八'], { startYear: 254, endYear: 255 }),
  rb('guanqiujian_xiu', 'guan_qiu_jian', 'guan_qiu_xiu', 'kinship_blood', '兄弟', false, 7,
    '毌丘秀为毌丘俭之弟，从兄起兵寿春；兵败奔吴，毌丘氏在中原者夷灭，奔吴一支得存。',
    [SGZ, '卷二十八·魏书·王毌丘诸葛邓钟传第二十八'], { startYear: 255, endYear: 255 }),
  rb('guanqiudian_simashi', 'si_ma_shi', 'guan_qiu_dian', 'political_rival', '夷俭三族', true, 8,
    '毌丘俭起兵讨司马氏，毌丘甸先知谋将发，私将家属走新安灵山；司马师别遣兵攻下之，夷俭三族。',
    [SGZ, '卷二十八·魏书·王毌丘诸葛邓钟传第二十八'], { startYear: 255, endYear: 255 }),

  /* ------------------------------ 泰山群寇 ------------------------------ */
  rb('zangba_sunguan', 'zang_ba', 'sun_guan', 'political_ally', '同起而霸为帅', false, 8,
    '黄巾起，臧霸收兵于徐州，与孙观、吴敦、尹礼并聚众，霸为帅，屯于开阳，时号泰山诸将。',
    [SGZ, '卷十八·魏书·二李臧文吕许典二庞阎传第十八'], { startYear: 184, endYear: 198 }),
  rb('zangba_wudun', 'zang_ba', 'wu_dun', 'political_ally', '同起，归曹为利城太守', false, 7,
    '吴敦与臧霸同聚众于开阳；曹操破吕布，使臧霸招之，以吴敦为利城太守。',
    [SGZ, '卷十八·魏书·二李臧文吕许典二庞阎传第十八'], { startYear: 184, endYear: 198 }),
  rb('zangba_yinli', 'zang_ba', 'yin_li', 'political_ally', '同起，归曹为东莞太守', false, 7,
    '尹礼与臧霸同聚众于开阳；曹操破吕布，使臧霸招之，以尹礼为东莞太守。',
    [SGZ, '卷十八·魏书·二李臧文吕许典二庞阎传第十八'], { startYear: 184, endYear: 198 }),
  rb('sunguan_sunkang', 'sun_guan', 'sun_kang', 'kinship_blood', '兄弟', false, 7,
    '孙康为孙观之兄，兄弟同从臧霸聚众；归曹后孙观为北海相、孙康为城阳太守。',
    [SGZ, '卷十八·魏书·二李臧文吕许典二庞阎传第十八'], { startYear: 184, endYear: 198 }),

  /* ------------------------------ 黑山军 ------------------------------ */
  rb('zhangyan_niujiao', 'zhang_yan', 'zhang_niu_jiao', 'political_ally', '推为帅，临死授众', false, 9,
    '张燕合聚少年为群盗，与博陵张牛角合，推牛角为帅；牛角中飞矢且死，令众「必以燕为帅」，众奉张燕，燕故改姓张。',
    [SGZ, '卷八·魏书·二公孙陶四张传第八'], { startYear: 185, endYear: 185 }),
  rb('zhangyan_gongsunzan', 'zhang_yan', 'gong_sun_zan', 'political_ally', '黑山救易京', false, 7,
    '袁绍围易京，公孙瓒遣子续请救于黑山诸帅；张燕与续率兵十万三道来救，未至而瓒已败。',
    [HHS, '卷七十三·刘虞公孙瓒陶谦列传第六十三'], { startYear: 199, endYear: 199 }),
  rb('zhangyan_yuanshao', 'zhang_yan', 'yuan_shao', 'military_adversary', '连年相攻', false, 7,
    '黑山军众至百万，与袁绍相攻连年；绍破之于常山，张燕人众稍散，后率众降曹操。',
    [SGZ, '卷八·魏书·二公孙陶四张传第八'], { startYear: 191, endYear: 205 }),

  /* ------------------------------ 五斗米道 ------------------------------
   * 张衡与张修之间刻意不连边：裴松之疑二者为一人之传写误，连边即自环。
   * 故此处只有「张鲁—张衡（父子）」与「张鲁—张修（袭杀）」两条，各自独立成立。 */
  rb('zhanglu_heng', 'zhang_lu', 'zhang_heng', 'kinship_blood', '父子，三世传道', true, 9,
    '张陵客蜀学道鹄鸣山中，陵死子衡行其道，衡死鲁复行之；五斗米道三世相承，至张鲁而据汉中。',
    [SGZ, '卷八·魏书·二公孙陶四张传第八']),
  rb('zhanglu_xiu', 'zhang_lu', 'zhang_xiu_wd', 'political_rival', '袭杀而夺其众', true, 8,
    '刘焉以张鲁为督义司马，与别部司马张修将兵击汉中太守苏固；张鲁遂袭杀张修，夺其众，据汉中。裴松之疑此张修即张衡。',
    [SGZ, '卷八·魏书·二公孙陶四张传第八（裴注引《典略》）'], { startYear: 191, endYear: 191 }),

  /* ------------------------------ 徐州 ------------------------------ */
  rb('taoqian_zerong', 'tao_qian', 'ze_rong', 'monarch_subject', '署为下邳相，督三郡运粮', true, 8,
    '笮融聚众数百往依陶谦，谦使督广陵、下邳、彭城三郡运粮；笮融遂断三郡委输，大起浮屠寺，陶谦亦不能制。',
    [SGZ, '卷四十九·吴书·刘繇太史慈士燮传第四（刘繇传）'], { startYear: 188, endYear: 194 }),
  rb('taoqian_caobao', 'tao_qian', 'cao_bao', 'monarch_subject', '故将', true, 6,
    '曹豹为陶谦故将，陶谦卒后为下邳相，与张飞共守下邳；旋反，间迎吕布。',
    [SGZ, '卷三十二·蜀书·先主传第二'], { startYear: 194, endYear: 196 }),
  rb('caobao_lvbu', 'cao_bao', 'lv_bu', 'political_ally', '反迎入下邳', true, 8,
    '袁术与吕布书，劝令袭下邳；下邳相曹豹反，间迎吕布，布遂入下邳，虏刘备妻子。',
    [SGZ, '卷三十二·蜀书·先主传第二'], { startYear: 196, endYear: 196 }),
  rb('caobao_liubei', 'liu_bei', 'cao_bao', 'monarch_subject', '守下邳而复叛', true, 7,
    '刘备领徐州，以曹豹为下邳相与张飞共守；曹豹与张飞不睦，遂反迎吕布，徐州由是失。',
    [SGZ, '卷三十二·蜀书·先主传第二'], { startYear: 195, endYear: 196 }),
  rb('zerong_sunce', 'sun_ce', 'ze_rong', 'military_adversary', '攻破其军', true, 7,
    '笮融屯县南拒孙策，策先击融，融败走；后融杀豫章太守朱皓据其城，为刘繇所破，逃入山中为民所杀。',
    [SGZ, '卷四十六·吴书·孙破虏讨逆传第一'], { startYear: 195, endYear: 195 }),
];
