import {Component, OnDestroy, OnInit} from '@angular/core';
import {ApiErrorHandleOpts, AppService, PlainObject} from "../../../../services/appService";
import {AdminPanelService} from "../../../../services/adminPanelService";
import {ApiQueryFail, ApiSuccess} from "../../../../services/apiService";
import {FormControl, FormGroup} from "@angular/forms";
import {userGroup} from "../user-groups/user-groups.component";
import {ActivatedRoute, Params} from "@angular/router";
import {countryList} from "../../app/countries/countries.component";
import {ValidatorService} from "../../../../services/validatorService";
import {MdbCheckboxChange} from "mdb-angular-ui-kit/checkbox";
import {MdbModalRef, MdbModalService} from "mdb-angular-ui-kit/modal";
import {DeleteRestoreUserComponent} from "./delete-restore-user/delete-restore-user.component";
import {BehaviorSubject, Subscription} from "rxjs";
import {MdbTabChange} from "mdb-angular-ui-kit/tabs/tabs.component";

export type userStatus = "active" | "disabled";

export interface userAccount {
  id: number,
  referrerId?: number | null,
  groupId: number,
  archived: number,
  status: userStatus,
  username: string,
  email?: string | null,
  emailVerified: number,
  phone?: string | null,
  phoneVerified: number,
  country?: string | null,
  createdOn: number,
  updatedOn: number,
  referrerUsername?: string | null,
  referralsCount?: number | null,
  _checksumValidated?: boolean | null
}

export interface userProfileDob {
  d: number,
  m: number,
  Y: number
}

export interface userProfile {
  userId: number,
  idVerified: number,
  addressVerified: number,
  firstName?: string | null,
  lastName?: string | null,
  gender?: string | null,
  address1?: string | null,
  address2?: string | null,
  postalCode?: string | null,
  city?: string | null,
  state?: string | null,
  isRegistered?: boolean | null,
  _checksumValidated?: boolean | null,
  dobTs?: number | null,
  dobDate?: userProfileDob | null
}

interface userFlagsList {
  [key: string]: userFlagEntry
}

interface userFlagEntry {
  label?: string,
  checked: boolean,
}

@Component({
  selector: 'app-manage-user',
  templateUrl: './manage-user.component.html',
  styleUrls: ['./manage-user.component.scss']
})
export class ManageUserComponent implements OnInit, OnDestroy {
  private queryWatch?: Subscription;
  private userId!: number;
  public user!: userAccount;
  public userProfile?: userProfile;
  public usersGroups: Array<userGroup> = [];
  public userAccountLoadErrors: Array<string> = [];
  public countriesList?: countryList;
  public validator: ValidatorService;

  public formsAreDisabled: boolean = true;

  public editAccountSuccess: boolean = false;
  public editAccountSubmit: boolean = false;
  public editAccountForm: FormGroup = new FormGroup({
    groupId: new FormControl("0"),
    status: new FormControl(),
    username: new FormControl(),
    email: new FormControl(),
    phone: new FormControl(),
    country: new FormControl(),
    totp: new FormControl(),
  });

  public editProfileSuccess: boolean = false;
  public editProfileSubmit: boolean = false;
  public editProfileForm: FormGroup = new FormGroup({
    firstName: new FormControl(),
    lastName: new FormControl(),
    gender: new FormControl("o"),
    dob: new FormControl(),
    address1: new FormControl(),
    address2: new FormControl(),
    postalCode: new FormControl(),
    city: new FormControl(),
    state: new FormControl(),
    totp: new FormControl()
  });

  public editReferrerSuccess: boolean = false;
  public editReferrerSubmit: boolean = false;
  public editReferrerForm: FormGroup = new FormGroup({
    referrer: new FormControl(),
    totp: new FormControl()
  });

  public resetActionSuccess?: string = "";
  public resetActionSubmit: boolean = false;
  public resetForm: FormGroup = new FormGroup({
    action: new FormControl(""),
    totp: new FormControl()
  });

  public verificationsFormSubmit: boolean = false;
  public verificationsFormAcc: FormGroup = new FormGroup({
    emailVerified: new FormControl("false"),
    phoneVerified: new FormControl("false"),
    totp: new FormControl()
  });

  public verificationsFormProfile: FormGroup = new FormGroup({
    idVerified: new FormControl("false"),
    addressVerified: new FormControl("false"),
    totp: new FormControl()
  });

  public passwordChangeSuccess: boolean = false;
  public passwordChangeSubmit: boolean = false;
  public passwordChangeForm: FormGroup = new FormGroup({
    password: new FormControl(""),
    flag: new FormControl(""),
    totp: new FormControl()
  });

  public flagsEditSuccess: boolean = false;
  public flagsEditSubmit: boolean = false;
  public flagsForm: FormGroup = new FormGroup({
    totp: new FormControl()
  });

  public editParamsSuccess: boolean = false;
  public editParamsSubmit: boolean = false;
  public editParamsForm: FormGroup = new FormGroup({
    secureData: new FormControl(),
    totp: new FormControl()
  });

  public userEncryptedParams: PlainObject = {};
  private userAccountTags?: Array<string>;
  public userFlags: userFlagsList = {};

  public deleteRestoreEvent?: BehaviorSubject<boolean | null>;
  public deleteRestoreUserModal?: MdbModalRef<DeleteRestoreUserComponent> = undefined;
  private deleteRestoreEventWatch?: Subscription;

  public baggageTabOpenEvent: BehaviorSubject<boolean | null> = new BehaviorSubject<boolean | null>(null);

  constructor(private app: AppService, private aP: AdminPanelService, private route: ActivatedRoute, private modals: MdbModalService) {
    this.validator = app.validator;
    this.queryWatch = this.route.queryParams.subscribe((params: Params) => {
      this.userId = parseInt(params["id"]);
    });
  }

  /**
   * User baggage events
   */
  public baggageTabOpen(e: MdbTabChange): void {
    if (/^Baggage/.test(e.tab.title)) {
      this.baggageTabOpenEvent.next(true);
    }
  }

  /**
   * Open Delete or Restore User Modal
   */
  public openDeleteRestoreUserModal(): void {
    this.deleteRestoreUserModal = this.modals.open(DeleteRestoreUserComponent, {
      data: {
        user: this.user,
        updateEvent: this.deleteRestoreEvent
      }
    });
  }

  /**
   * Edit User Encrypted Params
   */
  public async submitEditParams() {
    this.editParamsSuccess = false;
    let inputErrors: number = 0;
    let editParamsData: any = {
      user: this.user.id,
      action: "params",
      secureData: ""
    };

    // Secure data
    try {
      let secureDataStr = this.app.validator.validateInput(this.editParamsForm.get("secureData")?.value, false);
      if (secureDataStr.length) {
        if (secureDataStr.length < 3) {
          throw new Error('Secure data string length too short');
        }

        if (secureDataStr.length > 128) {
          throw new Error('Secure data string must not exceed 128 bytes');
        }
      }

      editParamsData.secureData = secureDataStr;
    } catch (e) {
      this.editParamsForm.get("secureData")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Totp
    try {
      editParamsData.totp = this.app.validator.validateTotp(this.editParamsForm.get("totp")?.value);
    } catch (e) {
      this.editParamsForm.get("totp")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Errors?
    if (inputErrors !== 0) {
      return;
    }

    // Clear out TOTP code
    this.editParamsForm.get("totp")?.setValue("");

    this.editParamsSubmit = true;
    this.formsAreDisabled = true;
    await this.app.api.callServer("post", "/auth/users/user", editParamsData).then((success: ApiSuccess) => {
      if (success.result.hasOwnProperty("status") && success.result.status === true) {
        this.editParamsSuccess = true;
      }
    }).catch((error: ApiQueryFail) => {
      this.app.handleAPIError(error, <ApiErrorHandleOpts>{formGroup: this.editParamsForm});
    });

    this.editParamsSubmit = false;
    this.formsAreDisabled = false;
  }

  public editParamsTotpType(e: any): void {
    this.validator.parseTotpField(e, () => {
      this.submitEditParams().then();
    });
  }

  /**
   * Edit User Account Flags/Tags
   */
  public async submitEditFlags() {
    this.flagsEditSuccess = false;
    let inputErrors: number = 0;
    let flagsFormData: any = {
      user: this.user.id,
      action: "tags",
      tags: ""
    };

    // New tags
    Object.keys(this.userFlags).forEach((flag: string) => {
      if (this.userFlags[flag].checked) {
        flagsFormData.tags += flag + ",";
      }
    });

    if (flagsFormData.tags.length) {
      flagsFormData.tags = flagsFormData.tags.slice(0, -1).toLowerCase();
    }

    // Totp
    try {
      flagsFormData.totp = this.app.validator.validateTotp(this.flagsForm.get("totp")?.value);
    } catch (e) {
      this.flagsForm.get("totp")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Clear out TOTP code
    this.flagsForm.get("totp")?.setValue("");

    if (this.userAccountTags) {
      if (this.userAccountTags.join(",").toLowerCase() === flagsFormData.tags) {
        this.app.notify.error('There are no changes to be saved!');
        return;
      }
    }

    // Errors?
    if (inputErrors !== 0) {
      return;
    }

    this.flagsEditSubmit = true;
    this.formsAreDisabled = true;
    await this.app.api.callServer("post", "/auth/users/user", flagsFormData).then((success: ApiSuccess) => {
      if (success.result.hasOwnProperty("status") && success.result.status === true) {
        this.flagsEditSuccess = true;
      }
    }).catch((error: ApiQueryFail) => {
      this.app.handleAPIError(error, <ApiErrorHandleOpts>{formGroup: this.flagsForm});
    });

    this.flagsEditSubmit = false;
    this.formsAreDisabled = false;
  }

  public editFlagsTotpType(e: any): void {
    this.validator.parseTotpField(e, () => {
      this.submitEditFlags().then();
    });
  }

  /**
   * Change Password
   */
  public passwordTotpType(e: any) {
    this.validator.parseTotpField(e, () => {
      this.submitPasswordChange().then();
    });
  }

  public async submitPasswordChange() {
    this.passwordChangeSuccess = false;
    let inputErrors: number = 0;
    let changePasswordData: any = {
      user: this.user.id,
      action: "password",
      password: "",
      flag: "",
      totp: ""
    }

    // Password
    try {
      changePasswordData.password = this.app.validator.validatePassword(this.passwordChangeForm.get("password")?.value, "Temporary password")
    } catch (e) {
      this.passwordChangeForm.get("password")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Flag
    changePasswordData.flag = this.passwordChangeForm.get("flag")?.value ?? "";

    // Totp
    try {
      changePasswordData.totp = this.app.validator.validateTotp(this.passwordChangeForm.get("totp")?.value);
    } catch (e) {
      this.passwordChangeForm.get("totp")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Errors?
    if (inputErrors !== 0) {
      return;
    }

    // Clear out TOTP code
    this.passwordChangeForm.get("totp")?.setValue("");

    this.passwordChangeSubmit = true;
    this.formsAreDisabled = true;
    await this.app.api.callServer("post", "/auth/users/user", changePasswordData).then((success: ApiSuccess) => {
      if (success.result.hasOwnProperty("status") && success.result.status === true) {
        this.passwordChangeSuccess = true;
      }
    }).catch((error: ApiQueryFail) => {
      this.app.handleAPIError(error, <ApiErrorHandleOpts>{formGroup: this.passwordChangeForm});
    });

    this.passwordChangeSubmit = false;
    this.formsAreDisabled = false;
  }

  /**
   * Verifications
   */
  public verifyAccTotpType(e: any) {
    this.validator.parseTotpField(e, () => {
      this.verifyAccSubmit().then();
    });
  }

  public async verifyAccSubmit() {
    let inputErrors: number = 0;
    let verifyData: any = {
      user: this.user.id,
      action: "verifications",
      emailVerified: "",
      phoneVerified: ""
    };

    // E-mail verified
    try {
      let emV = this.verificationsFormAcc.get("emailVerified")?.value ?? "";
      if (["true", "false"].indexOf(emV) < 0) {
        throw new Error('Invalid e-mail verification status');
      }

      verifyData.emailVerified = emV;
    } catch (e) {
      this.verificationsFormAcc.get("emailVerified")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Phone verified
    try {
      let phV = this.verificationsFormAcc.get("phoneVerified")?.value ?? "";
      if (["true", "false"].indexOf(phV) < 0) {
        throw new Error('Invalid phone verification status');
      }

      verifyData.phoneVerified = phV;
    } catch (e) {
      this.verificationsFormAcc.get("phoneVerified")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Totp
    try {
      verifyData.totp = this.app.validator.validateTotp(this.verificationsFormAcc.get("totp")?.value);
    } catch (e) {
      this.verificationsFormAcc.get("totp")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Errors?
    if (inputErrors !== 0) {
      return;
    }

    // Clear out TOTP code
    this.verificationsFormAcc.get("totp")?.setValue("");

    this.verificationsFormSubmit = true;
    this.formsAreDisabled = true;
    await this.app.api.callServer("post", "/auth/users/user", verifyData).then((success: ApiSuccess) => {
      if (success.result.hasOwnProperty("status") && success.result.status === true) {
        this.app.notify.success('User account verifications updated!');

        this.user.emailVerified = verifyData.emailVerified === "true" ? 1 : 0;
        this.user.phoneVerified = verifyData.phoneVerified === "true" ? 1 : 0;
      }
    }).catch((error: ApiQueryFail) => {
      this.app.handleAPIError(error, <ApiErrorHandleOpts>{formGroup: this.verificationsFormAcc});
    });

    this.verificationsFormSubmit = false;
    this.formsAreDisabled = false;
  }

  public verifyProfileTotpType(e: any) {
    this.validator.parseTotpField(e, () => {
      this.verifyProfileSubmit().then();
    });
  }

  public async verifyProfileSubmit() {
    let inputErrors: number = 0;
    let verifyData: any = {
      user: this.user.id,
      action: "verifications",
      idVerified: "",
      addressVerified: ""
    };

    // Identity verified
    try {
      let idV = this.verificationsFormProfile.get("idVerified")?.value ?? "";
      if (["true", "false"].indexOf(idV) < 0) {
        throw new Error('Invalid e-mail verification status');
      }

      verifyData.idVerified = idV;
    } catch (e) {
      this.verificationsFormProfile.get("idVerified")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Phone verified
    try {
      let adV = this.verificationsFormProfile.get("addressVerified")?.value ?? "";
      if (["true", "false"].indexOf(adV) < 0) {
        throw new Error('Invalid phone verification status');
      }

      verifyData.addressVerified = adV;
    } catch (e) {
      this.verificationsFormProfile.get("addressVerified")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Totp
    try {
      verifyData.totp = this.app.validator.validateTotp(this.verificationsFormProfile.get("totp")?.value);
    } catch (e) {
      this.verificationsFormProfile.get("totp")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Errors?
    if (inputErrors !== 0) {
      return;
    }

    // Clear out TOTP code
    this.verificationsFormProfile.get("totp")?.setValue("");

    this.verificationsFormSubmit = true;
    this.formsAreDisabled = true;
    await this.app.api.callServer("post", "/auth/users/profiles", verifyData).then((success: ApiSuccess) => {
      if (success.result.hasOwnProperty("status") && success.result.status === true) {
        this.app.notify.success('User profile verifications updated!');

        if (this.userProfile) {
          this.userProfile.idVerified = verifyData.idVerified === "true" ? 1 : 0;
          this.userProfile.addressVerified = verifyData.addressVerified === "true" ? 1 : 0;
        }
      }
    }).catch((error: ApiQueryFail) => {
      this.app.handleAPIError(error, <ApiErrorHandleOpts>{formGroup: this.verificationsFormProfile});
    });

    this.verificationsFormSubmit = false;
    this.formsAreDisabled = false;
  }

  /**
   * Reset account actions
   */
  public resetTotpType(e: any) {
    this.validator.parseTotpField(e, () => {
      this.submitResetForm().then();
    });
  }

  public async submitResetForm() {
    this.resetActionSuccess = undefined;
    let inputErrors: number = 0,
      action: string = "",
      totp: string = "";

    // Action
    try {
      action = this.resetForm.get("action")?.value;
      if (!action || ["checksum", "disable2fa", "re_credentials", "re_params"].indexOf(action) <= -1) {
        throw new Error('Invalid account reset action');
      }
    } catch (e) {
      this.resetForm.get("action")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Totp
    try {
      totp = this.app.validator.validateTotp(this.resetForm.get("totp")?.value);
    } catch (e) {
      this.resetForm.get("totp")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Errors?
    if (inputErrors !== 0) {
      return;
    }

    // Clear out TOTP code
    this.resetForm.get("totp")?.setValue("");

    this.resetActionSubmit = true;
    this.formsAreDisabled = true;
    await this.app.api.callServer("post", "/auth/users/user", {
      user: this.user.id,
      action: action,
      totp: totp,
    }).then((success: ApiSuccess) => {
      if (success.result.hasOwnProperty("success") && typeof success.result.success === "string" && success.result.success.length) {
        this.resetActionSuccess = success.result.success;
        if (action === "checksum") { // Assume that CHECKSUM is now good
          this.user._checksumValidated = true;
        }
      }
    }).catch((error: ApiQueryFail) => {
      this.app.handleAPIError(error, <ApiErrorHandleOpts>{formGroup: this.resetForm});
    });

    this.resetActionSubmit = false;
    this.formsAreDisabled = false;
  }

  /**
   * Edit profile
   */
  public editProfileTotpType(e: any) {
    this.validator.parseTotpField(e, () => {
      this.submitEditProfile().then();
    });
  }

  public async submitEditProfile() {
    this.editProfileSuccess = false;
    let inputErrors: number = 0;
    let profileData: any = {
      user: this.user.id,
      action: "update",
      firstName: "",
      lastName: "",
      gender: "",
      dob: "",
      address1: "",
      address2: "",
      postalCode: "",
      city: "",
      state: "",
      totp: ""
    };

    // Gender and DOB
    try {
      let gender = this.editProfileForm.controls.gender.value;
      if (typeof gender === "string" && gender.length > 0) {
        if (!(["o", "m", "f"].indexOf(gender) > -1)) {
          throw new Error('Invalid gender selection');
        }

        profileData.gender = gender;
      }
    } catch (e) {
      this.editProfileForm.get("gender")?.setErrors({message: e.message});
      inputErrors++;
    }

    let dob = this.editProfileForm.get("dob")?.value;
    if (dob instanceof Date) {
      profileData.dob = dob.toDateString();
    }

    // UTF-8 input fields
    let utf8Fields = ["firstName", "lastName", "address1", "address2", "postalCode", "city", "state"];
    utf8Fields.forEach((field: string) => {
      profileData[field] = this.editProfileForm.get(field)?.value ?? "";
    });

    // Totp
    try {
      profileData.totp = this.app.validator.validateTotp(this.editProfileForm.get("totp")?.value);
    } catch (e) {
      this.editProfileForm.get("totp")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Errors?
    if (inputErrors !== 0) {
      return;
    }

    // Clear out TOTP code
    this.editProfileForm.get("totp")?.setValue("");

    this.editProfileSubmit = true;
    this.formsAreDisabled = true;
    await this.app.api.callServer("post", "/auth/users/profiles", profileData).then((success: ApiSuccess) => {
      if (success.result.hasOwnProperty("profile") && typeof success.result.profile === "object") {
        this.editProfileSuccess = true;
        this.userProfile = <userProfile>success.result.profile;
      }
    }).catch((error: ApiQueryFail) => {
      this.app.handleAPIError(error, <ApiErrorHandleOpts>{formGroup: this.editProfileForm});
    });

    this.editProfileSubmit = false;
    this.formsAreDisabled = false;
  }

  /**
   * Edit referrer
   * @param e
   */
  public editReferrerTotpType(e: any) {
    this.validator.parseTotpField(e, () => {
      this.submitEditReferrer().then();
    });
  }

  public async submitEditReferrer() {
    this.editReferrerSuccess = false;
    let inputErrors: number = 0;
    let editRefData: any = {
      user: this.user.id,
      action: "referrer",
      referrer: "",
      totp: ""
    };

    // Referrer Username
    try {
      let referrerUsername = this.editReferrerForm.get("referrer")?.value;
      if (referrerUsername) {
        editRefData.referrer = this.validator.validateUsername(referrerUsername);
      }
    } catch (e) {
      this.editReferrerForm.get("referrer")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Totp
    try {
      editRefData.totp = this.app.validator.validateTotp(this.editReferrerForm.get("totp")?.value);
    } catch (e) {
      this.editReferrerForm.get("totp")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Errors?
    if (inputErrors !== 0) {
      return;
    }

    // Clear out TOTP code
    this.editReferrerForm.get("totp")?.setValue("");

    this.editReferrerSubmit = true;
    this.formsAreDisabled = true;

    await this.app.api.callServer("post", "/auth/users/user", editRefData).then((success: ApiSuccess) => {
      if (success.result.hasOwnProperty("status") && success.result.status === true) {
        this.editReferrerSuccess = true;
      }
    }).catch((error: ApiQueryFail) => {
      this.app.handleAPIError(error, <ApiErrorHandleOpts>{formGroup: this.editReferrerForm});
    });

    this.editReferrerSubmit = false;
    this.formsAreDisabled = false;
  }

  /**
   * Submitting edit account form
   * @param e
   */
  public editAccountTotpType(e: any) {
    this.validator.parseTotpField(e, () => {
      this.submitEditAccount().then();
    });
  }

  public async submitEditAccount() {
    this.editAccountSuccess = false;
    let inputErrors: number = 0;
    let accountData: any = {
      user: this.user.id,
      action: "account",
      groupId: 0,
      status: this.user.status,
      username: this.user.username,
      email: this.user.email ?? "",
      phone: this.user.phone ?? "",
      country: this.user.country ?? "",
      totp: ""
    };

    // Group
    try {
      let groupId = parseInt(this.editAccountForm.get("groupId")?.value ?? 0);
      if (!(groupId > 0 && groupId < Number.MAX_SAFE_INTEGER)) {
        throw new Error('Select a users group');
      }

      accountData.groupId = groupId;
    } catch (e) {
      this.editAccountForm.get("groupId")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Status
    try {
      accountData.status = this.editAccountForm.get("status")?.value ?? "";
      if (["active", "disabled"].indexOf(accountData.status) < 0) {
        throw new Error('Invalid user status');
      }
    } catch (e) {
      this.editAccountForm.get("status")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Username
    try {
      accountData.username = this.validator.validateUsername(this.editAccountForm.get("username")?.value);
    } catch (e) {
      this.editAccountForm.get("username")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Email
    try {
      accountData.email = this.editAccountForm.get("email")?.value ?? "";
      if (!accountData.email || !accountData.email.length) {
        accountData.email = "";
      } else {
        accountData.email = this.validator.validateEmail(accountData.email, 64);
      }
    } catch (e) {
      this.editAccountForm.get("email")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Phone
    try {
      accountData.phone = this.editAccountForm.get("phone")?.value;
      if (!accountData.phone || !accountData.phone.length) {
        accountData.phone = "";
      } else {
        if (!this.validator.isValidPhNum(accountData.phone)) {
          throw new Error('Invalid phone number');
        }
      }
    } catch (e) {
      this.editAccountForm.get("phone")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Country
    try {
      accountData.country = this.editAccountForm.get("country")?.value;
      if (!accountData.country || !accountData.country.length) {
        accountData.country = "";
      } else {
        if (!/^[a-z]{3}$/i.test(accountData.country)) {
          throw new Error('Invalid user country');
        }
      }
    } catch (e) {
      this.editAccountForm.get("country")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Totp
    try {
      accountData.totp = this.app.validator.validateTotp(this.editAccountForm.get("totp")?.value);
    } catch (e) {
      this.editAccountForm.get("totp")?.setErrors({message: e.message});
      inputErrors++;
    }

    // Errors?
    if (inputErrors !== 0) {
      return;
    }

    // Clear out TOTP code
    this.editAccountForm.get("totp")?.setValue("");

    this.editAccountSubmit = true;
    this.formsAreDisabled = true;

    await this.app.api.callServer("post", "/auth/users/user", accountData).then((success: ApiSuccess) => {
      if (success.result.hasOwnProperty("user") && typeof success.result.user === "object") {
        this.editAccountSuccess = true;
        let newUserData: userAccount = <userAccount>success.result.user;
        this.user.groupId = newUserData.groupId;
        this.user.status = newUserData.status;
        this.user.username = newUserData.username;
        this.user.email = newUserData.email;
        this.user.phone = newUserData.phone;
        this.user.country = newUserData.country;
      }
    }).catch((error: ApiQueryFail) => {
      this.app.handleAPIError(error, <ApiErrorHandleOpts>{formGroup: this.editAccountForm});
    });

    this.editAccountSubmit = false;
    this.formsAreDisabled = false;
  }

  /**
   * Load user's profile
   * @private
   */
  private async loadUserProfile() {
    this.app.api.callServer("get", "/auth/users/profiles", {user: this.user.id}).then((success: ApiSuccess) => {
      if (success.result.hasOwnProperty("profile") && typeof success.result.profile === "object") {
        this.userProfile = <userProfile>success.result.profile;

        this.editProfileForm.controls.firstName.setValue(this.userProfile.firstName);
        this.editProfileForm.controls.lastName.setValue(this.userProfile.lastName);
        this.editProfileForm.controls.gender.setValue(this.userProfile.gender ?? "o");

        if (this.userProfile.dobTs) {
          this.editProfileForm.controls.dob.setValue(new Date(this.userProfile.dobTs * 1000));
        }

        this.editProfileForm.controls.address1.setValue(this.userProfile.address1);
        this.editProfileForm.controls.address2.setValue(this.userProfile.address2);
        this.editProfileForm.controls.postalCode.setValue(this.userProfile.postalCode);
        this.editProfileForm.controls.city.setValue(this.userProfile.city);
        this.editProfileForm.controls.state.setValue(this.userProfile.state);

        if (this.userProfile.idVerified === 1) {
          this.verificationsFormProfile.controls.idVerified.setValue("true");
        }

        if (this.userProfile.addressVerified === 1) {
          this.verificationsFormProfile.controls.addressVerified.setValue("true");
        }
      }
    }).catch((error: ApiQueryFail) => {
      this.app.handleAPIError(error);
    });
  }

  /**
   * Load countries list from cache
   * @private
   */
  private async loadCountriesList() {
    this.app.api.callServer("get", "/auth/countries", {
      action: "list",
      cache: true
    }).then((success: ApiSuccess) => {
      if (success.result.hasOwnProperty("countries") && typeof success.result.countries === "object") {
        this.countriesList = <countryList>success.result.countries;

        if (this.user && typeof this.user.country === "string") {
          this.editAccountForm.controls.country.setValue(this.user.country);
        }
      }
    }).catch((error: ApiQueryFail) => {
      this.app.handleAPIError(error);
    });
  }

  /**
   * Account flags/tags
   */
  public updateUserFlagValue(flag: string, e: MdbCheckboxChange): void {
    flag = flag.toLowerCase();
    if (this.userFlags.hasOwnProperty(flag)) {
      this.userFlags[flag].checked = e.checked;
    }
  }

  private loadUserFlags(fetchedKnownFlags: Array<any>): void {
    if (fetchedKnownFlags.length) {
      fetchedKnownFlags.forEach((flag: string) => {
        this.userFlags[flag.toLowerCase()] = <userFlagEntry>{
          label: ManageUserComponent.userAccountFlagLabel(flag),
          checked: this.checkIfFlagIsChecked(flag)
        };
      });
    }
  }

  private checkIfFlagIsChecked(flag: string): boolean {
    if (this.userAccountTags) {
      if (this.userAccountTags.indexOf(flag.toUpperCase()) > -1) {
        return true;
      }
    }

    return false;
  }

  private static userAccountFlagLabel(flag: string): string | undefined {
    switch (flag.toLowerCase()) {
      case "tos_accepted":
        return "Terms of Services Accepted";
      case "pp_accepted":
        return "Privacy Policy Accepted";
      case "suggest_pw_change":
        return "Suggest a password change";
      case "force_pw_change":
        return "Force a password change";
      case "suggest_2fa_change":
        return "Suggest change of 2FA/GoogleAuth seed";
      case "account_limited_1":
        return "Account Limitations Set 1";
      case "account_limited_2":
        return "Account Limitations Set 2";
      case "account_limited_3":
        return "Account Limitations Set 3";
      case "promo_mails":
        return "Subscribed to Promotional E-mails";
      default:
        return undefined;
    }
  }

  /**
   * Load users groups & user account
   * @private
   */
  private async loadUserAccount() {
    if (!this.userId || this.userId <= 0) {
      this.app.router.navigate(["/auth/users/search"]).then();
      return;
    }

    await this.app.api.callServer("get", "/auth/users/groups", {}).then((success: ApiSuccess) => {
      this.usersGroups = success.result.groups;
    }).catch((error: ApiQueryFail) => {
      this.app.flash.userRetrieveFail = error.error ?? error.exception?.message ?? undefined;
    });

    if (!this.usersGroups.length) {
      this.app.router.navigate(["/auth/users/search"]).then();
      return;
    }

    await this.app.api.callServer("get", "/auth/users/user", {user: this.userId}).then((success: ApiSuccess) => {
      if (success.result.hasOwnProperty("user") && typeof success.result.user === "object") {
        this.user = <userAccount>success.result.user;

        if (success.result.hasOwnProperty("errors") && typeof success.result.errors === "object") {
          this.userAccountLoadErrors = success.result.errors;
        }

        // Flags & Tags
        if (success.result.hasOwnProperty("tags") && Array.isArray(success.result.tags)) {
          this.userAccountTags = success.result.tags;
        }

        if (success.result.hasOwnProperty("knownUsersFlags") && Array.isArray(success.result.knownUsersFlags)) {
          this.loadUserFlags(success.result.knownUsersFlags);
        }

        // Encrypted Params
        if (success.result.hasOwnProperty("params") && typeof success.result.params === "object") {
          this.userEncryptedParams = success.result.params;
        }
      }
    }).catch((error: ApiQueryFail) => {
      this.app.flash.userRetrieveFail = error.error ?? error.exception?.message ?? undefined;
    });

    if (!this.user) {
      this.app.router.navigate(["/auth/users/search"]).then();
      return;
    }

    this.loadUserProfile().then();

    this.editAccountForm.controls.status.setValue(this.user.status);
    this.editAccountForm.controls.groupId.setValue(this.user.groupId);
    this.editAccountForm.controls.username.setValue(this.user.username);
    this.editAccountForm.controls.email.setValue(this.user.email);
    this.editAccountForm.controls.phone.setValue(this.user.phone);

    if (this.countriesList) {
      this.editAccountForm.controls.country.setValue(this.user.country ?? "");
    }

    if (this.user.referrerUsername) {
      this.editReferrerForm.controls.referrer.setValue(this.user.referrerUsername);
    }

    if (this.user.emailVerified === 1) {
      this.verificationsFormAcc.controls.emailVerified.setValue("true");
    }

    if (this.user.phoneVerified === 1) {
      this.verificationsFormAcc.controls.phoneVerified.setValue("true");
    }

    if (this.userEncryptedParams) {
      this.editParamsForm.controls.secureData.setValue(this.userEncryptedParams["secureData"] ?? "");
    }

    this.deleteRestoreEvent = new BehaviorSubject<boolean | null>(null);
    this.deleteRestoreEventWatch?.unsubscribe();
    this.deleteRestoreEventWatch = this.deleteRestoreEvent.subscribe((value: boolean | null) => {
      if (typeof value === "boolean") {
        this.user.archived = value ? 1 : 0;
      }
    });

    this.formsAreDisabled = false;
    this.aP.breadcrumbs.next([
      {page: 'Users Control', icon: 'fal fa-users', link: '/auth/users/search'},
      {page: 'Search', link: '/auth/users/search'},
      {page: 'Edit Account # ' + this.user.id, active: true}
    ]);

    this.aP.titleChange.next(["User Account # " + this.user.id, "Users"]);
  }

  ngOnInit(): void {
    this.loadCountriesList().then();
    this.loadUserAccount().then();

    this.aP.breadcrumbs.next([
      {page: 'Users Control', icon: 'fal fa-users', active: true},
      {page: 'Search', active: true},
      {page: 'Edit Account', active: true},
    ]);

    this.aP.titleChange.next(["Edit Account", "Users"]);
  }

  ngOnDestroy() {
    this.queryWatch?.unsubscribe();
    this.deleteRestoreEventWatch?.unsubscribe();
  }
}
