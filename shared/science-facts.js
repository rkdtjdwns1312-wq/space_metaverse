import { SCIENCE_FACTS_EXTRA } from './science-facts-extra.js';

const SCIENCE_FACTS_BASE = Object.freeze([
  {
    id: 'science-01',
    title: '우주에서도 중력은 작용해요',
    paragraphs: [
      '우주정거장에서 우주인이 둥둥 떠다니는 모습을 보면 중력이 사라진 것 같아요. 하지만 지구 중력은 그곳에도 닿아 우주정거장과 사람을 함께 지구 쪽으로 끌어당깁니다.',
      '둘이 나란히 계속 떨어지면서 지구를 빗겨 돌기 때문에 바닥이 몸을 밀어 주지 않아요. 그래서 몸무게를 거의 느끼지 못하고 떠 있는 것처럼 보인답니다.'
    ],
    source: { title: 'NASA: What Is Microgravity? (Grades 5–8)', url: 'https://www.nasa.gov/learning-resources/for-kids-and-students/what-is-microgravity-grades-5-8/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-02',
    title: '계절은 지구의 기울기 때문에 생겨요',
    paragraphs: [
      '여름은 지구가 태양에 더 가까워져서 생긴다고 생각하기 쉽지만, 계절의 주된 까닭은 지구 자전축이 기울어져 있기 때문이에요. 지구가 태양 주위를 돌 때 각 반구가 받는 햇빛의 양과 낮의 길이가 달라집니다.',
      '우리 쪽이 태양을 향해 기울면 햇빛을 더 오래, 더 곧게 받아 여름이 되고, 반대쪽으로 기울면 겨울이 됩니다.'
    ],
    source: { title: 'NASA: Seasons on Earth, Mars, and Beyond', url: 'https://science.nasa.gov/helio-and-you-seasons-on-earth-mars-and-beyond/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-03',
    title: '달빛은 햇빛이 되돌아온 빛이에요',
    paragraphs: [
      '밤하늘의 달은 스스로 빛을 만드는 별이 아니에요. 태양빛을 받은 달 표면이 그 빛의 일부를 우리 쪽으로 되돌려 보내기 때문에 밝게 보입니다.',
      '달이 지구 주위를 돌면 우리가 보는 밝은 부분의 모양이 달라져 초승달, 보름달처럼 보여요. 달의 모양이 변하는 것은 달이 실제로 깎이거나 차오르는 일이 아니랍니다.'
    ],
    source: { title: 'NASA: Earth’s Moon', url: 'https://science.nasa.gov/moon/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-04',
    title: '태양도 별이에요',
    paragraphs: [
      '밤하늘의 반짝이는 별들과 태양은 모두 스스로 빛과 에너지를 내는 별이에요. 태양이 유난히 크고 밝게 보이는 까닭은 다른 별보다 지구에 훨씬 가까이 있기 때문입니다.',
      '태양의 중심에서는 작은 원자핵들이 합쳐지는 과정에서 에너지가 나오고, 그 에너지가 빛과 열이 되어 지구의 생명과 날씨에 큰 영향을 줍니다.'
    ],
    source: { title: 'NASA: Sun Facts', url: 'https://science.nasa.gov/sun/facts/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-05',
    title: '태양빛은 지구까지 약 8분 걸려요',
    paragraphs: [
      '빛은 아주 빠르게 움직이지만 태양과 지구 사이의 거리가 워낙 멀어서 햇빛이 지구에 도착하는 데 약 8분이 걸립니다. 지금 보는 태양은 아주 조금 전의 모습인 셈이에요.',
      '빛이 이동하는 데 시간이 걸린다는 사실은 먼 별을 볼 때 더 중요해요. 별빛은 긴 여행 끝에 우리 눈에 들어오므로, 우리는 별의 과거 모습을 관찰합니다.'
    ],
    source: { title: 'NASA: Facts About Earth', url: 'https://science.nasa.gov/earth/facts/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-06',
    title: '태양계 행성은 모두 여덟 개예요',
    paragraphs: [
      '태양 주위를 도는 행성은 수성, 금성, 지구, 화성, 목성, 토성, 천왕성, 해왕성으로 모두 여덟 개예요. 명왕성은 소중한 천체지만 지금은 행성이 아니라 왜소행성으로 분류됩니다.',
      '행성마다 크기와 표면, 대기가 달라요. 단단한 바위 표면이 있는 행성도 있고, 두꺼운 기체와 얼음 성분이 큰 행성도 있어 태양계는 다양한 세계의 모임입니다.'
    ],
    source: { title: 'NASA: Solar System Facts', url: 'https://science.nasa.gov/solar-system/solar-system-facts/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-07',
    title: '토성의 고리는 얼음과 바위 조각이에요',
    paragraphs: [
      '토성의 고리는 한 장의 단단한 원판이 아니에요. 아주 작은 알갱이부터 큰 덩어리까지 수많은 얼음과 바위 조각이 토성 둘레를 돌며 넓은 고리처럼 보입니다.',
      '각 조각은 토성의 중력에 붙잡혀 궤도를 따라 움직여요. 멀리서 보면 매끈한 고리 같지만 가까이에서는 조각들이 모인 복잡한 구조랍니다.'
    ],
    source: { title: 'NASA: Saturn Facts', url: 'https://science.nasa.gov/saturn/facts/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-08',
    title: '화성의 붉은빛은 녹슨 철 성분에서 와요',
    paragraphs: [
      '화성이 붉게 보이는 것은 땅과 먼지에 철 성분이 많고, 그 철이 산소와 반응해 녹과 비슷한 물질을 만들었기 때문이에요. 이 먼지가 넓게 퍼져 행성 전체가 붉은빛을 띱니다.',
      '화성의 하늘과 땅빛은 지구와 다르게 보일 수 있어요. 사진의 색은 카메라와 보정 방법에 따라서도 달라지므로, 색만으로 모든 표면의 모습을 단정할 수는 없습니다.'
    ],
    source: { title: 'NASA: Mars Facts', url: 'https://science.nasa.gov/mars/facts/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-09',
    title: '별똥별은 대개 작은 우주 먼지예요',
    paragraphs: [
      '밤하늘을 가로지르는 별똥별은 별이 떨어지는 모습이 아니에요. 우주를 떠돌던 작은 먼지나 돌 조각이 지구 대기로 들어오며 주변 공기와 부딪혀 밝게 빛나는 현상입니다.',
      '우주 공간에 있을 때는 유성체, 하늘에서 빛을 낼 때는 유성이라고 불러요. 타지 않고 땅까지 도착한 조각은 운석이라고 합니다.'
    ],
    source: { title: 'NASA: Meteors and Meteorites', url: 'https://science.nasa.gov/solar-system/meteors-meteorites/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-10',
    title: '우주에서 소리가 들리지 않는 까닭',
    paragraphs: [
      '소리는 물체의 떨림이 공기나 물 같은 물질을 차례로 흔들며 전달되는 파동이에요. 우주 공간은 물질이 매우 드문 곳이라 소리를 이어 전달할 매질이 거의 없습니다.',
      '그래서 우주선이 폭발하는 영화 장면처럼 우주 공간에서 큰 소리가 그대로 퍼지지는 않아요. 우주비행사는 우주복이나 통신 장치로 소리를 주고받습니다.'
    ],
    source: { title: 'NASA: What Is Sound?', url: 'https://spaceplace.nasa.gov/sound/en/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-11',
    title: '박쥐는 소리의 메아리로 길을 찾아요',
    paragraphs: [
      '많은 박쥐는 어두울 때 높은 소리를 내고, 물체에 부딪혀 돌아오는 메아리를 듣습니다. 메아리가 돌아오는 시간과 방향을 이용해 주변의 위치와 먹잇감을 알아차려요.',
      '박쥐가 장님이라는 말은 오해예요. 박쥐도 눈으로 볼 수 있고, 종에 따라 시각과 소리를 함께 이용합니다. 소리로 주변을 살피는 능력이 특히 뛰어난 것이지요.'
    ],
    source: { title: 'Smithsonian: Bat Facts', url: 'https://www.si.edu/spotlight/bats/batfacts' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-12',
    title: '벌은 꽃가루를 옮겨 식물을 도와요',
    paragraphs: [
      '벌이 꽃에서 꿀을 찾을 때 몸에 꽃가루가 묻고, 다른 꽃으로 이동하면서 꽃가루 일부를 옮길 수 있어요. 이 과정은 많은 식물이 씨앗과 열매를 만드는 데 도움을 줍니다.',
      '꽃가루받이는 벌만 하는 일이 아니에요. 나비와 새, 바람 등도 식물 종류에 따라 꽃가루를 옮깁니다. 꽃과 동물은 서로 영향을 주고받으며 살아갑니다.'
    ],
    source: { title: 'USDA: Pollinators', url: 'https://www.usda.gov/peoples-garden/pollinators' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-13',
    title: '식물은 빛을 이용해 양분을 만들어요',
    paragraphs: [
      '식물의 잎은 햇빛 에너지를 이용해 물과 이산화탄소로부터 당을 만드는 광합성을 해요. 당은 식물이 자라고 살아가는 데 쓰이는 양분이 됩니다.',
      '광합성 과정에서는 산소도 나와 주변 공기로 퍼져요. 식물은 뿌리로 물을 얻고 잎으로 빛과 공기를 받아, 살아 있는 생물과 지구 환경을 이어 줍니다.'
    ],
    source: { title: 'NASA Climate Kids: What Is Photosynthesis?', url: 'https://climatekids.nasa.gov/photosynthesis/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-14',
    title: '나무의 나이테는 자란 흔적이에요',
    paragraphs: [
      '나무줄기를 가로로 보면 둥근 고리처럼 보이는 나이테가 있어요. 나무가 자라며 해마다 새 조직을 더해 생기는 흔적이라, 나이테를 세면 나무의 나이를 짐작할 수 있습니다.',
      '고리의 폭과 모양은 해마다 같지 않을 수 있어요. 자라는 환경이 달라지면 나무의 성장도 달라지므로, 과학자들은 나이테를 살펴 과거 환경의 단서를 찾기도 합니다.'
    ],
    source: { title: 'USDA Forest Service: Tree Rings', url: 'https://www.fs.usda.gov/learn/trees/tree-rings' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-15',
    title: '버섯은 식물이 아니라 균류예요',
    paragraphs: [
      '버섯은 땅에서 자라고 움직이지 않아 식물처럼 보이지만, 식물과는 다른 균류에 속해요. 대부분의 버섯은 햇빛으로 양분을 만들지 않고 주변의 유기물을 분해하거나 흡수합니다.',
      '눈에 보이는 버섯은 균류의 일부일 뿐이에요. 땅속이나 나무 안에 실처럼 퍼진 균사체가 몸의 큰 부분을 이루며, 포자를 만들어 번식합니다.'
    ],
    source: { title: 'USDA Forest Service: Fungi', url: 'https://www.fs.usda.gov/wildflowers/ethnobotany/Mushrooms/index.shtml' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-16',
    title: '새는 깃털로 날고 몸을 보호해요',
    paragraphs: [
      '새의 깃털은 날개 모양을 만들고 공기를 밀어 날도록 돕습니다. 깃털은 몸을 덮어 따뜻함을 지키고, 비행 중 방향을 조절하거나 짝을 찾는 데에도 쓰일 수 있어요.',
      '모든 새가 같은 방식으로 나는 것은 아니에요. 날개와 몸의 모양, 살아가는 환경이 달라서 빠르게 날거나 오래 활공하는 등 비행 모습도 다양합니다.'
    ],
    source: { title: 'Smithsonian: What Makes a Bird?', url: 'https://nationalzoo.si.edu/animals/news/what-makes-bird-bird' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-17',
    title: '문어는 팔이 여덟 개예요',
    paragraphs: [
      '문어는 연체동물로, 머리 주변에 길고 유연한 팔 여덟 개가 있어요. 팔에는 빨판이 있어 물체를 붙잡고 표면을 살피는 데 도움을 줍니다.',
      '문어의 팔은 서로 독립적으로 움직일 수 있지만, 신경계와 몸이 함께 움직임을 조절해요. 문어는 뼈가 없어 좁은 틈으로 몸을 통과할 수 있는 독특한 동물입니다.'
    ],
    source: { title: 'Smithsonian Ocean: Octopus', url: 'https://ocean.si.edu/ocean-life/invertebrates/octopus' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-18',
    title: '고래는 물고기가 아니라 포유류예요',
    paragraphs: [
      '고래는 물속에서 살지만 물고기가 아니라 포유류예요. 폐로 공기를 마시고, 새끼를 낳아 젖을 먹이며, 몸의 온도를 일정하게 유지하는 특징이 있습니다.',
      '고래는 물 위로 올라와 숨구멍으로 공기를 내쉬고 다시 들이마셔요. 물고기처럼 아가미로 물속 산소를 얻는 것이 아니므로 숨을 쉬려면 수면에 올라와야 합니다.'
    ],
    source: { title: 'NOAA Fisheries: Whales', url: 'https://www.fisheries.noaa.gov/whales' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-19',
    title: '개미는 냄새 길을 남겨요',
    paragraphs: [
      '개미는 먹이를 찾으면 땅에 냄새 물질을 남기며 집으로 돌아올 수 있어요. 다른 개미가 그 냄새를 따라가면 먹이가 있는 곳을 함께 찾기 쉽습니다.',
      '길을 지나는 개미들이 냄새를 더 보태면 자주 쓰는 길의 신호가 강해질 수 있어요. 개미 무리는 이런 화학 신호와 접촉을 이용해 정보를 주고받습니다.'
    ],
    source: { title: 'Smithsonian: Ants Communicate With Chemicals', url: 'https://www.si.edu/spotlight/ants/communication' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-20',
    title: '씨앗은 여러 방법으로 여행해요',
    paragraphs: [
      '식물의 씨앗은 바람이나 물에 실리고, 동물의 털이나 먹이와 함께 옮겨지기도 해요. 씨앗이 부모 식물에서 멀리 퍼지면 햇빛과 물, 자랄 공간을 찾을 기회가 생깁니다.',
      '씨앗마다 이동 방법과 싹트는 조건이 달라요. 알맞은 온도와 물, 공기 등을 만나면 씨앗 속 배가 자라 새싹으로 나옵니다.'
    ],
    source: { title: 'USDA Forest Service: Seed Dispersal', url: 'https://www.fs.usda.gov/wildflowers/Native_Plant_Materials/Native_Gardening/seed.shtml' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-21',
    title: '혀는 맛을 느끼고 코는 풍미를 더해요',
    paragraphs: [
      '혀의 맛 감각 세포는 단맛, 짠맛, 신맛, 쓴맛, 감칠맛 같은 신호를 뇌로 보냅니다. 음식의 향은 코의 감각 세포가 알아차려 뇌에 전달해요.',
      '뇌는 맛과 냄새, 온도와 씹는 느낌을 함께 해석해 음식의 풍미를 느끼게 합니다. 감기에 걸려 코가 막히면 음식 맛이 밋밋하게 느껴질 수 있는 까닭이에요.'
    ],
    source: { title: 'NIH: Smell and Taste Disorders', url: 'https://health.nih.gov/health-topics-a-z/smell-and-taste-disorders' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-22',
    title: '피부는 따뜻함과 압력을 알아차려요',
    paragraphs: [
      '피부에는 압력, 진동, 따뜻함, 차가움 등을 알아차리는 여러 감각 신경 끝이 있어요. 이 신호는 신경을 따라 뇌로 전달되고, 뇌가 몸의 감각으로 해석합니다.',
      '감각은 몸을 주변 환경과 이어 주는 정보예요. 같은 물체도 누르는 세기나 온도에 따라 다르게 느껴질 수 있고, 피부의 감각은 몸을 보호하는 데에도 도움을 줍니다.'
    ],
    source: { title: 'NINDS: Brain Education Resources', url: 'https://www.ninds.nih.gov/health-information/public-education/brain-education-resources' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-23',
    title: '귀는 소리와 몸의 균형에 관여해요',
    paragraphs: [
      '귀 안쪽에는 소리의 떨림을 신경 신호로 바꾸는 구조가 있어요. 뇌는 양쪽 귀에 들어온 신호를 비교해 소리가 어느 쪽에서 오는지도 알아차릴 수 있습니다.',
      '귀 안의 다른 구조는 머리의 움직임과 방향 변화에 관한 정보를 보내 균형을 잡는 데 도움을 줍니다. 귀는 듣기만 하는 기관이 아니랍니다.'
    ],
    source: { title: 'NIDCD: How Do We Hear?', url: 'https://www.nidcd.nih.gov/health/how-do-we-hear' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-24',
    title: '땀은 몸을 식히는 데 도움을 줘요',
    paragraphs: [
      '몸이 더워지면 피부의 땀샘에서 땀이 나올 수 있어요. 땀의 물기가 피부에서 증발할 때 열을 가져가므로 몸을 식히는 데 도움이 됩니다.',
      '땀이 많이 나면 몸의 물도 줄어들 수 있어요. 땀은 몸의 온도를 조절하는 여러 방법 중 하나이며, 몸은 혈액 흐름 조절 등 다른 방법도 함께 사용합니다.'
    ],
    source: { title: 'MedlinePlus: Sweating', url: 'https://medlineplus.gov/ency/article/003218.htm' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-25',
    title: '뼈는 단단하면서도 살아 있는 조직이에요',
    paragraphs: [
      '뼈는 몸을 지탱하고 중요한 기관을 보호하며 근육과 함께 움직임을 돕습니다. 겉은 단단하지만 뼈 안에는 혈관과 세포가 있어 끊임없이 새 조직으로 바뀌는 살아 있는 부분이에요.',
      '몸은 오래된 뼈 조직을 조금씩 없애고 새 조직을 만드는 과정을 계속합니다. 그래서 뼈는 돌처럼 변하지 않는 물질이 아니라 몸의 변화에 반응하는 조직입니다.'
    ],
    source: { title: 'NIH NIAMS: Bone Basics', url: 'https://www.niams.nih.gov/health-topics/bone-basics' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-26',
    title: '심장은 온몸으로 피를 보내요',
    paragraphs: [
      '심장은 근육으로 된 기관으로, 수축과 이완을 반복해 혈액을 혈관으로 보냅니다. 혈액은 산소와 영양분을 몸 곳곳에 전달하고, 여러 물질을 다시 옮깁니다.',
      '달리거나 놀 때 심장이 더 빨리 뛰는 것은 활동 중인 몸에 혈액을 더 보내기 위해서예요. 심장 박동은 몸의 상태와 활동에 따라 달라질 수 있습니다.'
    ],
    source: { title: 'NIH NHLBI: How the Heart Works', url: 'https://www.nhlbi.nih.gov/health/heart/how-heart-works' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-27',
    title: '뇌는 몸의 신호를 모아 판단해요',
    paragraphs: [
      '뇌는 눈과 귀, 피부 등에서 온 정보를 받아 주변에서 무슨 일이 일어나는지 판단합니다. 그리고 신경을 통해 근육과 기관에 신호를 보내 몸의 반응을 조절해요.',
      '뇌의 여러 부분은 감각, 움직임, 기억, 생각 같은 일을 나누어 맡으면서 서로 협력합니다. 새로운 것을 배우고 경험을 기억하는 과정에도 뇌의 신경망이 관여합니다.'
    ],
    source: { title: 'NINDS: Brain Basics', url: 'https://www.ninds.nih.gov/health-information/public-education/brain-basics' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-28',
    title: '숨을 들이쉬면 산소가 혈액으로 가요',
    paragraphs: [
      '숨을 들이마시면 공기가 기도를 지나 폐 속 작은 공기주머니까지 들어갑니다. 그곳에서 산소는 혈액으로 이동하고, 혈액 속 이산화탄소는 반대 방향으로 나와 숨을 내쉴 때 몸 밖으로 나갑니다.',
      '폐는 공기를 단순히 저장하는 주머니가 아니에요. 넓은 표면과 혈관을 통해 공기와 혈액 사이에서 기체가 오가도록 돕습니다.'
    ],
    source: { title: 'NIH NHLBI: How the Lungs Work', url: 'https://www.nhlbi.nih.gov/health/lungs' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-29',
    title: '몸은 음식을 작은 영양분으로 나눠요',
    paragraphs: [
      '소화는 음식을 잘게 부수고 여러 기관과 효소의 도움으로 작은 영양분으로 나누는 과정이에요. 이렇게 된 영양분은 장에서 흡수되어 혈액을 통해 몸의 여러 부분으로 이동합니다.',
      '입에서 시작한 소화는 위와 소장을 지나며 이어져요. 음식 찌꺼기는 필요한 성분이 흡수된 뒤 몸 밖으로 나갑니다.'
    ],
    source: { title: 'NIDDK: Your Digestive System and How It Works', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/digestive-system-how-it-works' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-30',
    title: '눈은 빛을 받아 뇌에 그림을 전해요',
    paragraphs: [
      '빛은 눈의 투명한 부분을 지나 안쪽의 망막에 도착합니다. 망막의 감각 세포는 빛을 신경 신호로 바꾸고, 시신경을 통해 뇌로 보냅니다.',
      '우리가 보는 장면은 눈만으로 완성되는 것이 아니에요. 뇌가 양쪽 눈에서 온 신호를 해석해 색과 모양, 거리와 움직임을 알아차립니다.'
    ],
    source: { title: 'National Eye Institute: How the Eyes Work', url: 'https://www.nei.nih.gov/learn-about-eye-health/healthy-vision/how-eyes-work' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-31',
    title: '물은 얼음, 액체, 수증기로 달라져요',
    paragraphs: [
      '물은 얼 만큼 차가워지면 얼음이 돼요. 액체 물은 끓지 않아도 표면에서 수증기로 바뀌며 증발할 수 있어요. 고체, 액체, 기체는 물질이 존재하는 서로 다른 상태입니다.',
      '상태가 바뀌어도 물을 이루는 분자가 다른 물질로 바뀌는 것은 아니에요. 온도와 주변 조건에 따라 분자들의 움직임과 배열이 달라지는 것입니다.'
    ],
    source: { title: 'USGS: The Water Cycle', url: 'https://www.usgs.gov/special-topics/water-science-school/science/water-cycle' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-32',
    title: '얼음은 물에 뜨는 특별한 고체예요',
    paragraphs: [
      '대부분의 물질은 얼면 입자들이 더 촘촘히 모이지만, 물은 얼 때 분자들이 열린 모양의 결정 구조를 만듭니다. 그래서 같은 양의 얼음은 액체 물보다 더 많은 공간을 차지해요.',
      '부피가 커져 밀도가 낮아진 얼음은 물에 뜹니다. 호수 표면의 얼음층은 아래 물과 생물이 너무 빠르게 차가워지는 것을 줄이는 데 도움을 줄 수 있어요.'
    ],
    source: { title: 'USGS: Why Does Ice Float?', url: 'https://www.usgs.gov/special-topics/water-science-school/science/ice-snow-and-glaciers' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-33',
    title: '소금은 물에 녹아 보이지 않아도 남아 있어요',
    paragraphs: [
      '소금이 물에 녹으면 알갱이가 사라진 것처럼 보이지만, 소금 입자가 없어지는 것은 아니에요. 아주 작은 입자들이 물속에 고르게 퍼져 맨눈으로 구별하기 어려워진 것입니다.',
      '물이 증발해 사라지면 녹아 있던 소금은 다시 남을 수 있어요. 소금이 물에 녹는다는 것은 없어지는 일이 아니라 작은 입자로 물속에 퍼지는 변화입니다.'
    ],
    source: { title: 'USGS: Dissolved Solids and Water', url: 'https://www.usgs.gov/special-topics/water-science-school/science/dissolved-solids-and-water' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-34',
    title: '기체도 공간을 차지하고 무게가 있어요',
    paragraphs: [
      '공기는 보이지 않지만 여러 기체 분자로 이루어진 물질이에요. 공기는 공간을 차지하고 무게도 있으며, 지구 표면을 둘러싼 공기의 무게가 대기압을 만듭니다.',
      '공기가 바람으로 움직이고 압력이 달라지면 날씨에도 영향을 줍니다. 풍선에 공기를 넣으면 부풀어 오르는 것도 기체가 안에서 공간을 차지하기 때문이에요.'
    ],
    source: { title: 'NASA: What Is Air?', url: 'https://spaceplace.nasa.gov/air/en/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-35',
    title: '금속마다 자석에 끌리는 정도가 달라요',
    paragraphs: [
      '자석은 모든 금속을 똑같이 끌어당기지 않아요. 철과 일부 철을 포함한 물질은 강하게 끌릴 수 있지만, 구리나 알루미늄처럼 흔한 금속은 보통 자석에 눈에 띄게 붙지 않습니다.',
      '자석의 힘은 눈에 보이지 않는 자기장으로 주변에 퍼집니다. 자석에 잘 끌리는 물질 안에는 자기장에 반응하는 작은 영역들이 있어요.'
    ],
    source: { title: 'National High Magnetic Field Laboratory: Magnets', url: 'https://nationalmaglab.org/magnet-academy/learn/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-36',
    title: '열은 따뜻한 곳에서 차가운 곳으로 옮겨가요',
    paragraphs: [
      '따뜻한 물체와 차가운 물체가 만나면 에너지가 열의 형태로 따뜻한 쪽에서 차가운 쪽으로 이동합니다. 두 물체의 온도 차이가 줄어들 때까지 열의 이동이 이어질 수 있어요.',
      '열은 물체가 가진 온도 그 자체와는 달라요. 온도는 얼마나 뜨겁거나 차가운지를 나타내고, 열은 온도 차이 때문에 이동하는 에너지입니다.'
    ],
    source: { title: 'NASA: Heat and Temperature', url: 'https://www.nasa.gov/stem-content/heat-and-temperature/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-37',
    title: '힘을 주면 물체의 움직임이 달라져요',
    paragraphs: [
      '밀거나 당기는 작용을 힘이라고 해요. 힘은 멈춘 물체를 움직이게 하거나, 움직이는 물체의 빠르기와 방향을 바꿀 수 있습니다.',
      '같은 물체에 반대 방향의 힘이 똑같이 작용하면 움직임이 달라지지 않을 수 있어요. 물체의 운동은 힘의 크기와 방향, 물체의 질량에 따라 달라집니다.'
    ],
    source: { title: 'NASA: What Is a Force?', url: 'https://www.grc.nasa.gov/www/k-12/airplane/force.html' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-38',
    title: '빛은 거울에서 튕겨 나와요',
    paragraphs: [
      '빛이 매끄러운 거울 표면에 닿으면 반사되어 다른 방향으로 나아갑니다. 빛이 들어오는 방향과 반사되어 나가는 방향은 거울 표면을 기준으로 일정한 관계를 이룹니다.',
      '울퉁불퉁한 표면에서는 빛이 여러 방향으로 흩어져요. 그래서 거울에서는 선명한 상이 보이지만 종이와 벽에서는 빛이 퍼져 상이 맺히지 않습니다.'
    ],
    source: { title: 'NASA: Light and Reflection', url: 'https://spaceplace.nasa.gov/reflecting-light/en/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-39',
    title: '하늘이 파란 까닭은 빛이 흩어지기 때문이에요',
    paragraphs: [
      '햇빛은 여러 색의 빛이 섞여 있어요. 햇빛이 대기를 지나갈 때 공기 분자들이 빛을 여러 방향으로 흩뜨리는데, 파란빛은 빨간빛보다 더 잘 흩어져 하늘이 파랗게 보입니다.',
      '해가 낮게 있을 때는 빛이 대기를 더 긴 거리 지나와 붉고 주황빛이 두드러질 수 있어요. 하늘의 색은 빛과 대기가 만나는 방식에 따라 달라집니다.'
    ],
    source: { title: 'NASA Space Place: Why Is the Sky Blue?', url: 'https://spaceplace.nasa.gov/blue-sky/en/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-40',
    title: '무지개는 물방울 속에서 빛이 나뉘어 보여요',
    paragraphs: [
      '햇빛이 공기 중의 물방울에 들어가면 굴절하고, 물방울 안에서 반사된 뒤 다시 나올 수 있어요. 이 과정에서 여러 색의 빛이 서로 다른 방향으로 나뉘어 우리 눈에 도착합니다.',
      '태양은 등 뒤에 있고 앞쪽에 비가 내릴 때 무지개를 볼 수 있는 경우가 많아요. 사람마다 바라보는 방향이 달라 무지개를 보는 위치도 조금씩 달라집니다.'
    ],
    source: { title: 'NOAA SciJinks: What Makes a Rainbow?', url: 'https://scijinks.gov/rainbow/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-41',
    title: '물방울은 공기 중 수증기가 모여 생겨요',
    paragraphs: [
      '따뜻하고 습한 공기가 식으면 공기 중 수증기의 일부가 작은 물방울로 바뀔 수 있어요. 아주 작은 물방울이나 얼음 알갱이가 모여 구름을 이룹니다.',
      '구름은 솜처럼 가벼운 고체가 아니라 공기 중에 떠 있는 물방울과 얼음 알갱이의 모임이에요. 알갱이가 커지고 무거워지면 비나 눈으로 떨어질 수 있습니다.'
    ],
    source: { title: 'NOAA SciJinks: How Do Clouds Form?', url: 'https://scijinks.gov/clouds/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-42',
    title: '천둥은 번개가 만든 공기의 소리예요',
    paragraphs: [
      '번개는 구름이나 구름과 땅 사이에서 일어나는 강한 전기 방전이에요. 번개가 지나간 곳의 공기는 아주 빠르게 뜨거워지고 팽창하며 주변 공기를 흔듭니다.',
      '이 진동이 소리로 퍼진 것이 천둥이에요. 빛이 소리보다 훨씬 빨리 도착하므로 번개를 먼저 보고 천둥을 나중에 듣습니다.'
    ],
    source: { title: 'NOAA SciJinks: What Causes Thunder and Lightning?', url: 'https://scijinks.gov/lightning/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-43',
    title: '바닷물의 높낮이는 달과 태양의 중력에 영향을 받아요',
    paragraphs: [
      '밀물과 썰물은 바닷물의 높이가 주기적으로 오르내리는 현상이에요. 달의 중력이 큰 영향을 주고, 태양의 중력도 바닷물에 작용합니다.',
      '해안의 모양과 바다의 깊이, 지형에 따라 조수의 높이와 시간은 달라질 수 있어요. 그래서 지역마다 밀물과 썰물의 모습이 같지는 않습니다.'
    ],
    source: { title: 'NOAA Ocean Service: What Causes Tides?', url: 'https://oceanservice.noaa.gov/education/tutorial_tides/tides02_cause.html' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-44',
    title: '물은 땅과 하늘을 오가며 순환해요',
    paragraphs: [
      '햇빛을 받은 물은 증발해 수증기가 되고, 공기 중에서 식으면 작은 물방울이나 얼음 알갱이로 바뀔 수 있어요. 비와 눈으로 땅에 돌아온 물은 강과 바다로 흐르거나 땅속에 스며듭니다.',
      '식물도 뿌리로 흡수한 물의 일부를 잎을 통해 공기 중으로 내보내요. 물의 순환은 여러 길이 서로 이어진 복잡한 과정입니다.'
    ],
    source: { title: 'NOAA: The Water Cycle', url: 'https://www.noaa.gov/education/resource-collections/freshwater/water-cycle' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-45',
    title: '지구의 공기는 우주로부터 우리를 지켜요',
    paragraphs: [
      '지구를 둘러싼 대기는 숨 쉴 공기를 제공하고 날씨가 일어나는 공간이 됩니다. 대기의 여러 기체는 태양에서 오는 해로운 복사의 일부를 막고 지구의 온도를 유지하는 데에도 관여합니다.',
      '대기는 높이에 따라 성질이 다른 여러 층으로 나뉘어요. 우리가 사는 땅 가까운 층에서는 구름과 비, 바람 같은 날씨 현상이 주로 일어납니다.'
    ],
    source: { title: 'NASA: Earth’s Atmosphere', url: 'https://science.nasa.gov/earth/earth-atmosphere/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-46',
    title: '땅속의 물은 천천히 움직일 수 있어요',
    paragraphs: [
      '비가 땅에 내리면 일부 물은 흙과 바위 틈으로 스며들어 지하수가 됩니다. 지하수는 땅속의 빈 공간과 갈라진 틈을 따라 천천히 이동할 수 있어요.',
      '샘이나 우물은 지하수와 연결될 수 있습니다. 지하수는 비가 적은 시기에도 물을 공급하지만, 오염되면 땅속에서 정화와 회복에 오랜 시간이 걸릴 수 있습니다.'
    ],
    source: { title: 'USGS: Groundwater', url: 'https://www.usgs.gov/special-topics/water-science-school/science/groundwater' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-47',
    title: '화석은 오래전 생물과 환경의 단서예요',
    paragraphs: [
      '화석은 아주 오래전 생물의 몸이나 활동 흔적이 지층에 보존된 것이에요. 뼈나 껍데기뿐 아니라 발자국과 굴처럼 생물이 남긴 흔적도 화석이 될 수 있습니다.',
      '과학자들은 화석이 발견된 암석과 주변 지층을 함께 살펴 과거 생물의 모습과 당시 환경을 연구합니다. 화석은 지구 생명의 역사를 알려 주는 단서예요.'
    ],
    source: { title: 'National Park Service: What Is a Fossil?', url: 'https://www.nps.gov/subjects/fossils/what-is-a-fossil.htm' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-48',
    title: '지진은 땅속 암석이 움직이며 일어나요',
    paragraphs: [
      '지구의 단단한 겉부분은 큰 판 여러 개로 나뉘어 있고, 판들은 아주 느리게 움직입니다. 판의 경계나 지하의 단층에 힘이 쌓였다가 암석이 갑자기 움직이면 지진파가 퍼져 나갑니다.',
      '지진파가 지표에 도착하면 땅이 흔들려요. 지진은 대부분 지하에서 시작하며, 지진파를 관측하면 지진이 시작된 곳과 지구 내부 구조를 연구할 수 있습니다.'
    ],
    source: { title: 'USGS: What Is an Earthquake?', url: 'https://www.usgs.gov/programs/earthquake-hazards/earthquakes' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-49',
    title: '태양전지는 빛을 전기로 바꿔요',
    paragraphs: [
      '태양전지는 햇빛을 받으면 재료 안의 전하가 움직이도록 해 전류를 만드는 장치예요. 이렇게 얻은 전기는 전등이나 기기를 작동시키는 데 사용할 수 있습니다.',
      '햇빛의 양과 전지의 방향, 주변 조건에 따라 만들어지는 전기의 양이 달라져요. 그래서 태양전지는 햇빛이 잘 드는 곳에 설치하고 필요한 전기를 저장하거나 나누어 씁니다.'
    ],
    source: { title: 'U.S. Department of Energy: Solar Photovoltaic Cell Basics', url: 'https://www.energy.gov/eere/solar/solar-photovoltaic-cell-basics' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  },
  {
    id: 'science-50',
    title: '인공위성은 지구를 돌며 정보를 모아요',
    paragraphs: [
      '인공위성은 로켓으로 우주에 보내 지구나 다른 천체 주위를 돌게 한 장치예요. 위성은 카메라와 여러 센서로 구름, 바다, 땅의 모습 같은 정보를 관측할 수 있습니다.',
      '위성이 모은 자료는 일기예보와 지도, 통신 등 다양한 일에 활용돼요. 위성은 지구와 계속 떨어져 나가는 것이 아니라 중력에 이끌리면서 앞으로 나아가 궤도를 따라 돕니다.'
    ],
    source: { title: 'NASA: What Is a Satellite?', url: 'https://www.nasa.gov/learning-resources/for-kids-and-students/what-is-a-satellite-grades-5-8/' },
    adaptation: '어린이 눈높이로 정리한 과학 이야기'
  }
]);

export const SCIENCE_FACTS = Object.freeze([...SCIENCE_FACTS_BASE, ...SCIENCE_FACTS_EXTRA]);
