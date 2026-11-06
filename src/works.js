'use strict';
/**
 * «Наши работы» — настоящие фото «до/после» с объектов клиента.
 * Файлы лежат в public/static/img/. Чтобы добавить работу — положите туда фото 1200×900
 * (слева «до», справа «после») и допишите строку ниже.
 * group — фильтр на странице; service — слаг услуги для ссылки «Заказать такую уборку».
 */
module.exports = [
  { img: 'foto-kuhnya.jpg', title: 'Вытяжка: застарелый жир отмыт полностью', group: 'Кухня', service: 'uborka-kuhni' },
  { img: 'foto-vannaya.jpg', title: 'Плитка в душевой: известковый налёт и ржавчина', group: 'Ванная', service: 'myte-vannoy-komnaty' },
  { img: 'foto-generalnaya.jpg', title: 'Генеральная уборка комнаты', group: 'Квартира', service: 'generalnaya-uborka' },
  { img: 'foto-stul.jpg', title: 'Химчистка велюрового стула', group: 'Мебель', service: 'himchistka-stula' },
  { img: 'foto-okna.jpg', title: 'Мытьё балконных окон', group: 'Окна', service: 'myte-okon' },
  { img: 'foto-rakovina.jpg', title: 'Кухонная раковина: налёт и пятна', group: 'Кухня', service: 'uborka-kuhni' },
  { img: 'foto-mozaika.jpg', title: 'Душевая с мозаикой', group: 'Ванная', service: 'myte-vannoy-komnaty' },
  { img: 'foto-podderzhka.jpg', title: 'Кухонный гарнитур после уборки', group: 'Кухня', service: 'podderzhivayushchaya-uborka' },
  { img: 'foto-smesitel.jpg', title: 'Смеситель и душевая стойка', group: 'Ванная', service: 'myte-vannoy-komnaty' },
  { img: 'foto-pod-krovatyu.jpg', title: 'Съёмная квартира: уборка под кроватью', group: 'Квартира', service: 'generalnaya-uborka' },
  { img: 'foto-stiralka.jpg', title: 'Лоток стиральной машины', group: 'Ванная', service: 'myte-vannoy-komnaty' },
  { img: 'foto-lyustra.jpg', title: 'Хрустальная люстра снова сверкает', group: 'Квартира', service: 'generalnaya-uborka' },
];
