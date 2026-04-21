import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { sendTeamApplicationToTelegram, type TeamApplicationData } from '../utils/telegram';
import './TeamEntry.css';

type TeamFormState = {
  name: string;
  occupation: string;
  occupationOther: string;
  incomeSatisfaction: string;
  incomeReason: string;
  desiredIncome: string;
  dailyWorkReadiness: string;
  experience: string;
  priority: string;
  telegram: string;
  instagram: string;
  whatsapp: string;
  max: string;
};

const STORAGE_KEY = 'team_entry_form';
const LAST_SUBMIT_KEY = 'team_entry_last_submit_at';
const RATE_LIMIT_MS = 15000;

const initialState: TeamFormState = {
  name: '',
  occupation: '',
  occupationOther: '',
  incomeSatisfaction: '',
  incomeReason: '',
  desiredIncome: '',
  dailyWorkReadiness: '',
  experience: '',
  priority: '',
  telegram: '',
  instagram: '',
  whatsapp: '',
  max: ''
};

const FIELD_ORDER: (keyof TeamFormState | 'contacts')[] = [
  'name',
  'occupation',
  'occupationOther',
  'incomeSatisfaction',
  'incomeReason',
  'desiredIncome',
  'dailyWorkReadiness',
  'experience',
  'priority',
  'contacts',
  'telegram',
  'instagram',
  'whatsapp',
  'max'
];

function countDigits(s: string): number {
  return (s.match(/\d/g) || []).length;
}

function validateTelegram(value: string): boolean {
  return /^[a-zA-Z0-9_]{5,32}$/.test(value);
}

function validateInstagram(value: string): boolean {
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(value)) return false;
  if (value.startsWith('.') || value.endsWith('.')) return false;
  if (value.includes('..')) return false;
  return true;
}

/** WhatsApp: номер, если поле заполнено — 10–15 цифр (международный формат) */
function validateWhatsApp(value: string): boolean {
  if (!value.trim()) return true;
  const d = countDigits(value);
  return d >= 10 && d <= 15;
}

/** MAX: телефон или ник, 2–50 символов */
function validateMax(value: string): boolean {
  if (!value.trim()) return true;
  const t = value.trim();
  if (t.length < 2 || t.length > 50) return false;
  return true;
}

function normalizeUsername(value: string): string {
  return value.replace(/^@+/, '').trim();
}

/** Нормализация ввода телефона: оставляем цифры, +, пробелы, скобки, дефис */
function normalizePhoneInput(value: string): string {
  return value.replace(/[^\d+\s()\-]/g, '');
}

function hasAnyContact(form: TeamFormState): boolean {
  return (
    form.telegram.trim().length > 0 ||
    form.instagram.trim().length > 0 ||
    form.whatsapp.trim().length > 0 ||
    form.max.trim().length > 0
  );
}

function validateAll(form: TeamFormState): Record<string, string> {
  const next: Record<string, string> = {};

  if (!form.name.trim()) next.name = 'Обязательное поле';
  if (!form.occupation) next.occupation = 'Обязательное поле';
  if (form.occupation === 'other' && !form.occupationOther.trim()) {
    next.occupationOther = 'Уточните ваш вариант';
  }
  if (!form.incomeSatisfaction) next.incomeSatisfaction = 'Обязательное поле';
  if (!form.incomeReason.trim()) next.incomeReason = 'Обязательное поле';
  if (!form.desiredIncome.trim()) next.desiredIncome = 'Обязательное поле';
  if (!form.dailyWorkReadiness) next.dailyWorkReadiness = 'Обязательное поле';
  if (!form.experience.trim()) next.experience = 'Обязательное поле';
  if (!form.priority) next.priority = 'Обязательное поле';

  if (!hasAnyContact(form)) {
    next.contacts = 'Укажите хотя бы один способ связи';
  }
  if (form.telegram.trim() && !validateTelegram(form.telegram)) {
    next.telegram = '5–32 символа: латиница, цифры, _';
  }
  if (form.instagram.trim() && !validateInstagram(form.instagram)) {
    next.instagram = '1–30 символов: латиница, цифры, . _';
  }
  if (form.whatsapp.trim() && !validateWhatsApp(form.whatsapp)) {
    next.whatsapp = 'Введите номер: 10–15 цифр (с кодом страны)';
  }
  if (form.max.trim() && !validateMax(form.max)) {
    next.max = '2–50 символов (телефон или ник в MAX)';
  }

  return next;
}

function scrollToFirstTeamError(errors: Record<string, string>) {
  for (const key of FIELD_ORDER) {
    if (errors[key as string]) {
      const id = key === 'contacts' ? 'team-field-contacts' : `team-field-${key}`;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      break;
    }
  }
}

export const TeamEntry: React.FC = () => {
  const [form, setForm] = useState<TeamFormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { form?: Partial<TeamFormState> };
      if (parsed.form) {
        setForm((prev) => ({ ...prev, ...parsed.form }));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ form }));
    } catch {
      // ignore
    }
  }, [form]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setErrors((prev) => {
        const next = { ...prev };
        if (form.telegram) {
          if (!validateTelegram(form.telegram)) {
            next.telegram = '5–32 символа: латиница, цифры, _';
          } else {
            delete next.telegram;
          }
        }
        if (form.instagram) {
          if (!validateInstagram(form.instagram)) {
            next.instagram = '1–30 символов: латиница, цифры, . _';
          } else {
            delete next.instagram;
          }
        }
        if (form.whatsapp) {
          if (!validateWhatsApp(form.whatsapp)) {
            next.whatsapp = 'Номер: 10–15 цифр (с кодом страны)';
          } else {
            delete next.whatsapp;
          }
        }
        if (form.max) {
          if (!validateMax(form.max)) {
            next.max = '2–50 символов';
          } else {
            delete next.max;
          }
        }
        if (hasAnyContact(form)) {
          delete next.contacts;
        }
        return next;
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [form.telegram, form.instagram, form.whatsapp, form.max]);

  const setField = (key: keyof TeamFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const out = { ...prev };
      delete out[key];
      if (key === 'telegram' || key === 'instagram' || key === 'whatsapp' || key === 'max') {
        delete out.contacts;
      }
      return out;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateAll(form);
    if (Object.keys(validation).length > 0) {
      setErrors((prev) => ({ ...prev, ...validation }));
      scrollToFirstTeamError(validation);
      return;
    }

    if (submitLockRef.current || isSubmitting) return;

    const lastSubmit = Number(localStorage.getItem(LAST_SUBMIT_KEY) || 0);
    const now = Date.now();
    if (now - lastSubmit < RATE_LIMIT_MS) {
      setErrors((prev) => ({
        ...prev,
        submit: 'Пожалуйста, подождите несколько секунд перед повторной отправкой.'
      }));
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.submit;
      return next;
    });

    const payload: TeamApplicationData = {
      name: form.name.trim(),
      telegram: form.telegram.trim(),
      instagram: form.instagram.trim(),
      whatsapp: form.whatsapp.trim(),
      max: form.max.trim(),
      occupation: form.occupation,
      occupationOther: form.occupationOther.trim(),
      incomeSatisfaction: form.incomeSatisfaction,
      incomeReason: form.incomeReason.trim(),
      desiredIncome: form.desiredIncome.trim(),
      dailyWorkReadiness: form.dailyWorkReadiness,
      experience: form.experience.trim(),
      priority: form.priority
    };

    try {
      const ok = await sendTeamApplicationToTelegram(payload);
      if (!ok) {
        setErrors((prev) => ({
          ...prev,
          submit: 'Не удалось отправить форму. Проверьте данные и попробуйте снова.'
        }));
        return;
      }

      localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));
      localStorage.removeItem(STORAGE_KEY);
      setIsSuccess(true);
    } catch (error) {
      console.error('Team form submit error:', error);
      setErrors((prev) => ({
        ...prev,
        submit: 'Произошла ошибка при отправке. Попробуйте позже.'
      }));
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div className="team-page">
      <header className="team-header">
        <Link to="/" className="logo-link">
          <img src="/logo.svg" alt="Logo" className="header-logo" />
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="team-content">
        <section className="team-intro">
          <h1>Форма входа в команду</h1>
          <p>
            Когда я начинал в бизнесе, у меня не было ни команды из сотен людей, ни оборота в миллионы долларов.
            Эта анкета — не формальность.
            Это ваш первый шаг в систему, где результат — не случайность, а закономерность.
          </p>
          <h2>Продумайте каждый ответ.</h2>
        </section>

        {isSuccess ? (
          <section className="team-success">
            <h3>Спасибо за ответы.</h3>
            <p>
              После изучения анкеты мы свяжемся с вами, чтобы обсудить формат сотрудничества и договориться о личной
              встрече.
            </p>
            <Link to="/" className="team-back-home">
              На главную
            </Link>
          </section>
        ) : (
          <section className="team-form-card">
            <form className="team-form-all" onSubmit={handleSubmit} noValidate>
              <div className="team-section" id="team-field-name">
                <h3 className="team-section-title">1. Ваше имя *</h3>
                <input
                  type="text"
                  className={`team-input ${errors.name ? 'error' : ''}`}
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Как к вам обращаться"
                  autoComplete="name"
                />
                {errors.name && <p className="team-error">{errors.name}</p>}
              </div>

              <div className="team-section" id="team-field-occupation">
                <h3 className="team-section-title">2. Чем вы занимаетесь сейчас? *</h3>
                <div className="team-options">
                  {['Работа', 'Бизнес', 'Декрет', 'Фриланс', 'Свое дело'].map((option) => (
                    <label key={option} className="team-option">
                      <input
                        type="radio"
                        name="occupation"
                        checked={form.occupation === option}
                        onChange={() => {
                          setField('occupation', option);
                          setField('occupationOther', '');
                        }}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                  <label className="team-option">
                    <input
                      type="radio"
                      name="occupation"
                      checked={form.occupation === 'other'}
                      onChange={() => setField('occupation', 'other')}
                    />
                    <span>Другое</span>
                  </label>
                </div>
                {form.occupation === 'other' && (
                  <div id="team-field-occupationOther" className="team-other-wrap">
                    <input
                      type="text"
                      className={`team-input ${errors.occupationOther ? 'error' : ''}`}
                      value={form.occupationOther}
                      onChange={(e) => setField('occupationOther', e.target.value)}
                      placeholder="Уточните ваш вариант"
                    />
                  </div>
                )}
                {(errors.occupation || errors.occupationOther) && (
                  <p className="team-error">{errors.occupation || errors.occupationOther}</p>
                )}
              </div>

              <div className="team-section" id="team-field-incomeSatisfaction">
                <h3 className="team-section-title">3. Устраивает ли вас текущий доход? *</h3>
                <div className="team-options">
                  {['Полностью устраивает', 'Хотелось бы больше', 'Категорически не устраивает'].map((option) => (
                    <label key={option} className="team-option">
                      <input
                        type="radio"
                        name="incomeSatisfaction"
                        checked={form.incomeSatisfaction === option}
                        onChange={() => setField('incomeSatisfaction', option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
                {errors.incomeSatisfaction && <p className="team-error">{errors.incomeSatisfaction}</p>}
              </div>

              <div className="team-section" id="team-field-incomeReason">
                <h3 className="team-section-title">4. Почему рассматриваете новый доход? *</h3>
                <textarea
                  className={`team-textarea ${errors.incomeReason ? 'error' : ''}`}
                  value={form.incomeReason}
                  onChange={(e) => setField('incomeReason', e.target.value)}
                  placeholder="Ваш ответ"
                  rows={4}
                />
                {errors.incomeReason && <p className="team-error">{errors.incomeReason}</p>}
              </div>

              <div className="team-section" id="team-field-desiredIncome">
                <h3 className="team-section-title">5. Желаемый доход через 12 месяцев *</h3>
                <input
                  type="text"
                  className={`team-input ${errors.desiredIncome ? 'error' : ''}`}
                  value={form.desiredIncome}
                  onChange={(e) => setField('desiredIncome', e.target.value)}
                  placeholder="Например: 300 000 ₽ / 5000 $"
                />
                {errors.desiredIncome && <p className="team-error">{errors.desiredIncome}</p>}
              </div>

              <div className="team-section" id="team-field-dailyWorkReadiness">
                <h3 className="team-section-title">6. Готовы ли работать 1–2 часа в день системно? *</h3>
                <div className="team-options">
                  {['Да', 'Нет', 'Не уверен(а)'].map((option) => (
                    <label key={option} className="team-option">
                      <input
                        type="radio"
                        name="dailyWorkReadiness"
                        checked={form.dailyWorkReadiness === option}
                        onChange={() => setField('dailyWorkReadiness', option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
                {errors.dailyWorkReadiness && <p className="team-error">{errors.dailyWorkReadiness}</p>}
              </div>

              <div className="team-section" id="team-field-experience">
                <h3 className="team-section-title">7. Есть ли опыт в продажах / сетевом / бизнесе? *</h3>
                <textarea
                  className={`team-textarea ${errors.experience ? 'error' : ''}`}
                  value={form.experience}
                  onChange={(e) => setField('experience', e.target.value)}
                  placeholder="Кратко опишите опыт"
                  rows={4}
                />
                {errors.experience && <p className="team-error">{errors.experience}</p>}
              </div>

              <div className="team-section" id="team-field-priority">
                <h3 className="team-section-title">8. Что для вас важнее? *</h3>
                <div className="team-options">
                  {['Быстрые деньги', 'Долгосрочная система', 'Окружение и развитие'].map((option) => (
                    <label key={option} className="team-option">
                      <input
                        type="radio"
                        name="priority"
                        checked={form.priority === option}
                        onChange={() => setField('priority', option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
                {errors.priority && <p className="team-error">{errors.priority}</p>}
              </div>

              <div
                className={`team-contacts-panel ${errors.contacts ? 'team-contacts-panel-error' : ''}`}
                id="team-field-contacts"
              >
                <h3 className="team-section-title team-contacts-heading">9. Как с вами связаться? *</h3>
                <p className="team-contacts-lead">
                  Заполните удобные вам мессенджеры — <strong>достаточно указать минимум один</strong> способ. Пустые
                  поля можно оставить пустыми.
                </p>
                {errors.contacts && <p className="team-error team-contacts-banner">{errors.contacts}</p>}

                <div className="team-contacts-grid">
                  <div className="team-contact-cell" id="team-field-telegram">
                    <span className="team-contact-label">Telegram</span>
                    <input
                      type="text"
                      inputMode="text"
                      autoComplete="username"
                      className={`team-input ${errors.telegram ? 'error' : ''}`}
                      value={form.telegram}
                      onChange={(e) => setField('telegram', normalizeUsername(e.target.value))}
                      placeholder="username (без @)"
                    />
                    {errors.telegram ? (
                      <p className="team-error">{errors.telegram}</p>
                    ) : (
                      <p className="team-hint">Латиница, 5–32 символа</p>
                    )}
                  </div>

                  <div className="team-contact-cell" id="team-field-instagram">
                    <span className="team-contact-label">Instagram</span>
                    <input
                      type="text"
                      className={`team-input ${errors.instagram ? 'error' : ''}`}
                      value={form.instagram}
                      onChange={(e) => setField('instagram', normalizeUsername(e.target.value))}
                      placeholder="username (без @)"
                    />
                    {errors.instagram ? (
                      <p className="team-error">{errors.instagram}</p>
                    ) : (
                      <p className="team-hint">Публичный ник, без @</p>
                    )}
                  </div>

                  <div className="team-contact-cell" id="team-field-whatsapp">
                    <span className="team-contact-label">WhatsApp</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className={`team-input ${errors.whatsapp ? 'error' : ''}`}
                      value={form.whatsapp}
                      onChange={(e) => setField('whatsapp', normalizePhoneInput(e.target.value))}
                      placeholder="+7 900 123-45-67"
                    />
                    {errors.whatsapp ? (
                      <p className="team-error">{errors.whatsapp}</p>
                    ) : (
                      <p className="team-hint">Номер в международном формате</p>
                    )}
                  </div>

                  <div className="team-contact-cell" id="team-field-max">
                    <span className="team-contact-label">MAX</span>
                    <input
                      type="text"
                      inputMode="text"
                      className={`team-input ${errors.max ? 'error' : ''}`}
                      value={form.max}
                      onChange={(e) => setField('max', e.target.value)}
                      placeholder="Телефон или ник в MAX"
                    />
                    {errors.max ? (
                      <p className="team-error">{errors.max}</p>
                    ) : (
                      <p className="team-hint">Как вам удобнее</p>
                    )}
                  </div>
                </div>
              </div>

              {errors.submit && <p className="team-error submit-error">{errors.submit}</p>}

              <div className="team-actions team-actions-single">
                <button type="submit" className="team-btn team-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Отправка...' : 'Отправить анкету'}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
};
