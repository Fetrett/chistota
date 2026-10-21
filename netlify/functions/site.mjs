// Netlify Function: обслуживает все страницы сайта и админку.
// Статические файлы из public/ (CSS, JS, шрифты, картинки) Netlify отдаёт сам — preferStatic.
import app from '../../src/app.js';

export default async (request, context) => app.handle(request, { ip: context.ip });

export const config = { path: '/*', preferStatic: true };
